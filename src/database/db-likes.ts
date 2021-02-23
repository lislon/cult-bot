import { MyInterval } from '../interfaces/app-interfaces'
import { mapToPgInterval, rangeHalfOpenIntersect } from './db-utils'
import { ColumnSet, IDatabase, IMain } from 'pg-promise'
import { AdminEvent } from './db-admin'


export interface AutoIncrementLikeQuery {
    interval: MyInterval
}

export type LikableEvent = Pick<AdminEvent, 'extId' | 'fakeDislikes' | 'id' | 'fakeLikes'>

export class LikesRepository {
    readonly columns: ColumnSet

    constructor(private db: IDatabase<any>, private pgp: IMain) {
        this.columns = new pgp.helpers.ColumnSet([
            'id',
            'ext_id',
            'likes_fake',
            'dislikes_fake',
        ], {table: 'cb_events'})
    }

    public async getAllLikableEvents(query: AutoIncrementLikeQuery): Promise<LikableEvent[]> {
        // TODO: Из подборок тоже
        return await this.db.map(`
            SELECT cb.id, cb.ext_id, cb.likes_fake, cb.dislikes_fake
            FROM cb_events cb
            WHERE cb.deleted_at IS NULL
                AND EXISTS
                (
                    select id
                    FROM cb_events_entrance_times cbet
                    where ${rangeHalfOpenIntersect('$(interval)::tstzrange', 'cbet.entrance')} AND cbet.event_id = cb.id
                )
            `,
            {
                interval: mapToPgInterval(query.interval),
            }, row => {
                return {
                    id: +row.id,
                    extId: row.ext_id,
                    fakeLikes: +row.likes_fake,
                    fakeDislikes: +row.dislikes_fake,
                }
            })
    }
}

