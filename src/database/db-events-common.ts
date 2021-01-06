import { Event, MyInterval } from '../interfaces/app-interfaces'
import { mapToPgInterval, rangeHalfOpenIntersect } from './db-utils'
import { ColumnSet, IColumnConfig, IDatabase, IMain, ITask } from 'pg-promise'

interface CountEventsQuery {
    interval: MyInterval
}

export interface LikeDislikeChange {
    plusLikes: number
    plusDislikes: number
}

export function mapEvent(row: any) {
    return {
        ...row,
        id: +row.id
    } as Event
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

    constructor(private db: IDatabase<any>, private pgp: IMain) {
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

        function getArrayPushPopColumnSettings(name: string): IColumnConfig<{}> {
            return {
                name: name,
                init: c => c.value > 0 ? `array_append(${name}, ${c.value}::int8)` : `array_remove(${name}, ${-c.value}::int8)`,
                skip: (c: { value: any }) => c.value === null || c.value === undefined || c.value === 0,
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

    public async voteEvent(userId: number, eventId: number, vote: 'like'|'dislike'): Promise<LikeDislikeChange> {
        return await this.db.txIf(async (dbTx: ITask<{}>) => {
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
                    return 'like';
                } else if (row.is_disliked) {
                    return 'dislike';
                } else {
                    return 'empty'
                }
            })

            function getChange(oldVote: 'like'|'dislike'|'empty', newVote: 'like'|'dislike') {
                if (oldVote === 'empty') {
                    return [(newVote === 'like' ? 1 : 0), (newVote === 'dislike' ? 1 : 0)]
                }
                if (oldVote !== newVote) {
                    return [(newVote === 'like' ? 1 : -1), (newVote === 'dislike' ? 1 : -1)]
                }
                if (oldVote === newVote) {
                    return [(newVote === 'like' ? -1 : 0), (newVote === 'dislike' ? -1 : 0)]
                }
            }

            const [plusLikes, plusDislikes] = getChange(oldChoose, vote);

            const query = this.pgp.helpers.update({
                likes: plusLikes,
                dislikes: plusDislikes,
            }, this.columns) + ' WHERE id = $(eventId)';

            await dbTx.none(query, { eventId })

            const queryUpdateUser = this.pgp.helpers.update({
                events_liked: eventId * plusLikes,
                events_disliked: eventId * plusDislikes,
            }, this.columnsUserLikes) + ' WHERE id = $(userId)';

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

    public async getFavorites(eventIds: number[]): Promise<Event[]> {
        if (eventIds.length === 0) {
            return []
        }
        return this.db.map(`
            select ${SELECT_ALL_EVENTS_FIELDS}
            from cb_events cb
            JOIN unnest('{$(eventIds:list)}'::int[]) WITH ORDINALITY t(id, ord) USING (id)
            ORDER BY ord;
        `, {eventIds}, mapEvent)
    }


}
