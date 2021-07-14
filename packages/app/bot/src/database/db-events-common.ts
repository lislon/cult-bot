import { Event, DateInterval, TagLevel2, LatLng } from '../interfaces/app-interfaces'
import { EventCategory } from '@culthub/interfaces'
import { mapToPgInterval, rangeHalfOpenIntersect } from './db-utils'
import { ColumnSet, IColumnConfig, IDatabase, IMain, ITask } from 'pg-promise'
import { IExtensions } from './db'
import { DbEvent } from '../interfaces/db-interfaces'
import { Exhibition } from '@culthub/interfaces/typings/api/web';

interface CountEventsQuery {
    interval: DateInterval
}

export interface LikeDislikeChange {
    plusLikes: number
    plusDislikes: number
}

export function mapExhibition(row: ({ id: string, place: string, latlng: { x: number, y: number } })): Exhibition {
    return {
        id: +row.id,
        title: row.place,
        lat: row.latlng.x,
        lng: row.latlng.y
    }
}

export function mapEventSingle(row?: (DbEvent & { id: string, likes: number, dislikes: number })): Event | undefined {
    return row ? mapEvent(row) : undefined
}

export function mapEvent(row: (DbEvent & { id: string, likes: number, dislikes: number })): Event {
    return {
        id: +row.id,
        extId: row.ext_id,
        category: row.category as EventCategory,
        title: row.title,
        place: row.place,
        address: row.address,
        geotag: row.geotag,
        timetable: row.timetable,
        duration: row.duration,
        price: row.price,
        notes: row.notes,
        description: row.description,
        url: row.url,
        tag_level_1: row.tag_level_1,
        tag_level_2: row.tag_level_2 as TagLevel2[],
        tag_level_3: row.tag_level_3,
        rating: +row.rating,
        reviewer: row.reviewer,
        likes: +row.likes,
        dislikes: +row.dislikes,
        publish: 'true'
    }
}

const selectCbLikesDislikes = `cb.likes + cb.likes_fake AS likes, cb.dislikes + cb.dislikes_fake as dislikes`

export const SELECT_ALL_EVENTS_FIELDS: string = [
    'id',
    'title',
    'category',
    'place',
    'address',
    'timetable',
    'duration',
    'price',
    'notes',
    'description',
    'url',
    'tag_level_1',
    'tag_level_2',
    'tag_level_3',
    'order_rnd',
    'rating',
    'reviewer',
    'is_anytime',
    'geotag',
    'ext_id',
].map(t => `cb.${t}`).join(',') + ',' + selectCbLikesDislikes


// 'likes',
// 'dislikes',
// 'likes_fake',
// 'dislikes_fake',

export class EventsCommonRepository {

    readonly columns: ColumnSet

    readonly columnsUserLikes: ColumnSet

    constructor(private db: IDatabase<unknown>, private pgp: IMain) {
        this.columns = new pgp.helpers.ColumnSet([
            '?id',
            {
                name: 'likes',
                init: c => `likes + ` + c.value,
                mod: ':raw'
            },
            {
                name: 'dislikes',
                init: c => `dislikes + ` + c.value,
                mod: ':raw'
            },
        ], {table: 'cb_events'})

        function getArrayPushPopColumnSettings(name: string): IColumnConfig<IExtensions> {
            return {
                name: name,
                init: c => c.value > 0 ? `array_append(${name}, ${c.value}::int8)` : `array_remove(${name}, ${-c.value}::int8)`,
                skip: (c: { value: unknown }) => c.value === null || c.value === undefined || c.value === 0,
                mod: ':raw'
            }
        }

        this.columnsUserLikes = new pgp.helpers.ColumnSet([
            '?id',
            getArrayPushPopColumnSettings('events_liked'),
            getArrayPushPopColumnSettings('events_disliked'),
        ], {table: 'cb_users'})
    }

    public async countEvents(query: CountEventsQuery): Promise<number> {
        return this.db.one(`
            SELECT COUNT(cb.id) AS count
            FROM cb_events cb
            WHERE
                cb.deleted_at IS NULL
                AND EXISTS
                (
                    select id
                    FROM cb_events_entrance_times cbet
                    where ${rangeHalfOpenIntersect('$(interval)::tstzrange', 'cbet.entrance')} AND cbet.event_id = cb.id
                )
        `, {
            interval: mapToPgInterval(query.interval),
        }, (row) => +row.count)
    }

    public async voteEvent(userId: number, eventId: number, vote: 'like' | 'dislike'): Promise<LikeDislikeChange> {
        return await this.db.txIf(async (dbTx: ITask<IExtensions>) => {
            const oldChoose = await dbTx.one(`
                SELECT
                    ($(eventIdArr)::int8[] <@ events_liked) AS is_liked,
                    ($(eventIdArr)::int8[] <@ events_disliked) AS is_disliked
                FROM cb_users cu
                WHERE cu.id = $(userId)
            `, {
                eventIdArr: [eventId],
                userId: userId
            }, (row) => {
                if (row.is_liked) {
                    return 'like'
                } else if (row.is_disliked) {
                    return 'dislike'
                } else {
                    return 'empty'
                }
            })

            function getChange(oldVote: 'like' | 'dislike' | 'empty', newVote: 'like' | 'dislike'): [number, number] {
                if (oldVote === 'empty') {
                    return [(newVote === 'like' ? 1 : 0), (newVote === 'dislike' ? 1 : 0)]
                } else if (oldVote !== newVote) {
                    return [(newVote === 'like' ? 1 : -1), (newVote === 'dislike' ? 1 : -1)]
                } else if (oldVote === newVote) {
                    return [(newVote === 'like' ? -1 : 0), (newVote === 'dislike' ? -1 : 0)]
                } else {
                    throw new Error(`wtf ${oldVote} vs ${newVote}`)
                }
            }

            const [plusLikes, plusDislikes] = getChange(oldChoose, vote)

            const query = this.pgp.helpers.update({
                likes: plusLikes,
                dislikes: plusDislikes,
            }, this.columns) + ' WHERE id = $(eventId)'

            await dbTx.none(query, {eventId})

            const queryUpdateUser = this.pgp.helpers.update({
                events_liked: eventId * plusLikes,
                events_disliked: eventId * plusDislikes,
            }, this.columnsUserLikes) + ' WHERE id = $(userId)'

            await dbTx.none(queryUpdateUser, {userId})
            return {plusLikes, plusDislikes}
        })
    }

    public async getLikesDislikes(eventId: number): Promise<[number, number]> {
        return this.db.one(`
            select ${selectCbLikesDislikes}
            from cb_events cb
            where cb.id = $(eventId)
        `, {eventId}, (row) => [+row.likes, +row.dislikes])
    }

    public async getEventsByIds(eventIds: number[]): Promise<Event[]> {
        if (eventIds.length === 0) {
            return []
        }
        return await this.db.map(`
            select ${SELECT_ALL_EVENTS_FIELDS}
            from cb_events cb
            JOIN unnest('{$(eventIds:list)}'::int[]) WITH ORDINALITY t(id, ord) USING (id)
            ORDER BY ord
        `, {eventIds}, mapEvent)
    }

    public async getEventsByExtId(extId: string): Promise<Event | undefined> {
        return (await this.db.oneOrNone(`
            select ${SELECT_ALL_EVENTS_FIELDS}
            from cb_events cb
            WHERE cb.ext_id = $(extId)
        `, {extId}, mapEventSingle)) || undefined
    }

    public async getExhibitions(): Promise<Exhibition[]> {
        return (await this.db.map(`
            select ce.id, ce.place, ce.latlng
            from cb_events ce 
            where ce.id IN(
                select MAX(ce.id)
                from cb_events ce 
                where ce.latlng is not null
                group by ce.place
            )
        `, {}, mapExhibition))
    }

    public async logViews(eventIds: number[]): Promise<void> {
        if (eventIds.length > 0) {
            await this.db.none(`
                update cb_events
                set views = views + 1
                WHERE id IN ($(eventIds:csv))
            `, {eventIds})
        }
    }

}
