import { Event, DateInterval } from '../interfaces/app-interfaces'
import { EventCategory } from '@culthub/interfaces'
import { mapToPgInterval, rangeHalfOpenIntersect } from './db-utils'
import { ColumnSet, IColumnConfig, IDatabase, IMain, ITask } from 'pg-promise'
import { IExtensions } from './db'
import { DbEvent } from '../interfaces/db-interfaces'

export interface GeoPoint {
    lat: number
    lng: number
}


export interface GeoTagEvent {
    id: number
    geotag: string
}

export interface EventLatLngUpdate {
    id: number
    point: GeoPoint
}


export class EventsGeoRepository {

    readonly columns: ColumnSet

    constructor(private db: IDatabase<any>, private pgp: IMain) {
        this.columns = new pgp.helpers.ColumnSet([
            '?id',
            {
                name: 'latlng',
                init: c => `'` + c.value + `'`,
                cast: '::point',
                mod: ':raw'
            },
        ], {table: 'cb_events'})

    }

    public async getOfflineEventsWithMissingLatLng(limit: number): Promise<GeoTagEvent[]> {
        return await this.db.map(`
            select id, geotag
            from cb_events cb
            WHERE cb.address != 'онлайн'
            AND cb.deleted_at IS NULL AND latlng IS NULL
            ORDER BY id ASC
            LIMIT $(limit)
            `, { limit },  row => ({id: +row.id, geotag: row.geotag }))
    }

    public async saveLatLng(events: EventLatLngUpdate[]): Promise<void> {
        if (events.length === 0) {
            return
        }

        const data = events.map(e => ({
            id: e.id,
            latlng: `(${e.point.lat}, ${e.point.lng})`
        }))

        const s = this.pgp.helpers.update(data, this.columns) + ' WHERE v.id = t.id'
        await this.db.none(s)
    }


}
