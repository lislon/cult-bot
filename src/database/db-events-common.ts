import { MyInterval } from '../interfaces/app-interfaces'
import { mapToPgInterval, rangeHalfOpenIntersect } from './db-utils'
import { ColumnSet, IDatabase, IMain } from 'pg-promise'

interface CountEventsQuery {
    interval: MyInterval
}

export class EventsCommonRepository {
    readonly columns: ColumnSet

    constructor(private db: IDatabase<any>, private pgp: IMain) {
        this.columns = new pgp.helpers.ColumnSet([
            'title',
            'description',
            'author',
            'weight',
            {name: 'event_ids', cast: '_int8'},
        ], {table: 'cb_events_packs'})
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
}