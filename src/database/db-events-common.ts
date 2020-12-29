import { MyInterval } from '../interfaces/app-interfaces'
import { mapToPgInterval, rangeHalfOpenIntersect } from './db-utils'
import { ColumnSet, IDatabase, IMain, ITask } from 'pg-promise'

interface CountEventsQuery {
    interval: MyInterval
}
export interface LikeDislikeChange {
    plusLikes: number
    plusDislikes: number
}

export class EventsCommonRepository {
    public readonly selectCbLikesDislikes = `cb.likes + cb.likes_fake AS likes, cb.dislikes + cb.dislikes_fake as dislikes`
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

        this.columnsUserLikes = new pgp.helpers.ColumnSet([
            '?id',
            {
                name: 'events_liked',
                init: c => c.value > 0 ? `array_append(events_liked, ${c.value}::int8)` : `array_remove(events_liked, ${-c.value}::int8)`,
                skip: (c: { value: any }) => c.value === null || c.value === undefined || c.value === 0,
                mod: ':raw'
            },
            {
                name: 'events_disliked',
                init: c => c.value > 0 ? `array_append(events_disliked, ${c.value}::int8)` : `array_remove(events_disliked, ${-c.value}::int8)`,
                skip: (c: { value: any }) => c.value === null || c.value === undefined || c.value === 0,
                mod: ':raw'
            },
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
            select ${this.selectCbLikesDislikes}
            from cb_events cb
            where cb.id = $(eventId)
        `, {eventId}, (row) => [+row.likes, +row.dislikes])
    }

}
