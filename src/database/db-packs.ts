import { MyInterval } from '../interfaces/app-interfaces'
import { mapToPgInterval, rangeHalfOpenIntersect } from './db-utils'
import { ColumnSet, IDatabase, IMain, ITask } from 'pg-promise'
import { IExtensions } from './db'

// export interface TopEventsQuery {
//     category: EventCategory
//     interval: MyInterval
//     oblasti?: string[]
//     limit?: number
//     offset?: number
// }

export interface EventPackForSave {
    title: string
    description: string
    author: string
    eventIds: number[]
    image: Buffer|null
    imageSrc: string
    weight: number
}

export interface PackForList {
    id: number
    title: string
    countEvents: number
    // description: string
    // author: string
    // packTime: Date[]
    // eventIds: number[]
    // image: Buffer|null
    // imageSrc: string
}

export interface PacksQuery {
    interval: MyInterval
}

export class PacksRepository {
    readonly columns: ColumnSet

    constructor(private db: IDatabase<any>, private pgp: IMain) {
        this.columns = new pgp.helpers.ColumnSet([
            'title',
            'description',
            'author',
            'weight',
            { name: 'event_ids', cast: '_int8' },
            'image',
            ], {table: 'cb_events_packs'})
    }

    public async sync(packs: EventPackForSave[]) {
        await this.db.tx(async (dbTx: ITask<IExtensions> & IExtensions) => {
            await dbTx.none('DELETE FROM cb_events_packs')
            const s = this.pgp.helpers.insert(packs.map(p => {
                return {
                    title: p.title,
                    description: p.description,
                    author: p.author,
                    weight: p.weight,
                    event_ids: p.eventIds,
                    image: p.image
                }
            }), this.columns)
            await dbTx.none(s)
        })
    }

    public async listPacks(query: PacksQuery): Promise<PackForList[]> {
        return await this.db.map(`
            SELECT p.id, p.title, COUNT(cb.id) count_events
            FROM cb_events_packs p
            JOIN cb_events cb ON (cb.id = ANY(p.event_ids ))
            WHERE EXISTS
            (
                select id
                FROM cb_events_entrance_times cbet
                where ${rangeHalfOpenIntersect('$(interval)::tstzrange', 'cbet.entrance')} AND cbet.event_id = cb.id
            )
            GROUP BY p.id
            ORDER BY p.weight ASC, p.title ASC
            `, { interval: mapToPgInterval(query.interval) },
            r => {
                return {
                    id: +r.id,
                    title: r.title,
                    countEvents: r.count_events
                }
            })
    }

    public async fetchLoadedImages(): Promise<string[]> {
        return await this.db.manyOrNone(`
            SELECT image_src
            FROM cb_events_packs p
        `)
    }

    public async fetchIdsByExtIds(extIds: string[]): Promise<{ id: number; extId: string }[]> {
        if (extIds.length === 0) {
            return []
        }
        return await this.db.map(`
            SELECT e.id, e.ext_id
            FROM cb_events e
            WHERE e.ext_id IN ($(extIds:csv))
            `, { extIds }, ({ id, ext_id}) => {
                return {id: +id, extId: ext_id}
            })
    }
}

