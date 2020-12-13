import { Event, MyInterval } from '../interfaces/app-interfaces'
import { mapToPgInterval, rangeHalfOpenIntersect } from './db-utils'
import { ColumnSet, IBaseProtocol, IDatabase, IMain, ITask } from 'pg-promise'
import { db, IExtensions } from './db'
import { zip } from 'lodash'

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

export interface ScenePack {
    id: number
    title: string
    events: PackEventSummary[]
    description: string
    imageSrc: string
}

export interface PackEventSummary {
    id: number
    title: string
}

export interface PackWithEvents {
    id: number
    title: string
    description: string
    imageSrc: string
    events: PackEventSummary[]
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
            'image_src',
            'image',
            ], {table: 'cb_events_packs'})
    }

    public async sync(packs: EventPackForSave[], outerDbTx: IBaseProtocol<{}> = db): Promise<number[]> {
        return await outerDbTx.txIf({ reusable: true }, async (dbTx: ITask<IExtensions> & IExtensions) => {
            await dbTx.none('DELETE FROM cb_events_packs')
            if (packs.length > 0) {
                const s = this.pgp.helpers.insert(packs.map(p => {
                    return {
                        title: p.title,
                        description: p.description,
                        author: p.author,
                        weight: p.weight,
                        event_ids: p.eventIds,
                        image: p.image,
                        image_src: p.imageSrc
                    }
                }), this.columns) + ' RETURNING id'

                return await dbTx.map(s, [], r => +r.id)
            } else {
                return []
            }
        })
    }

    public async listPacks(query: PacksQuery): Promise<ScenePack[]> {
        return await this.db.map(`
            SELECT
                p.id,
                p.title,
                p.description,
                p.image_src,
                array_agg(pe.id) event_ids,
                array_agg(pe.title) event_titles
            from cb_events_packs p
            join (
                SELECT cb.*
                FROM (
                    SELECT cbet.event_id, MIN(LOWER(cbet.entrance)) AS first_entrance
                    FROM cb_events_entrance_times cbet
                    JOIN cb_events_packs p on cbet.event_id = any (p.event_ids)
                    WHERE ${rangeHalfOpenIntersect('$(interval)::tstzrange', 'cbet.entrance')}
                    GROUP by cbet.event_id
                ) cbet
                JOIN cb_events cb ON cb.id = cbet.event_id
                ORDER BY cb.is_anytime ASC, cbet.first_entrance ASC, cb.rating DESC
            ) pe on (pe.id = any(p.event_ids))
            GROUP BY p.id
            ORDER BY p.weight ASC, p.title ASC
            `, { interval: mapToPgInterval(query.interval) },
            r => {
                return {
                    id: +r.id,
                    title: r.title,
                    description: r.description,
                    imageSrc: r.image_src,
                    events: zip<string, string>(r.event_ids, r.event_titles)
                        .map(([id, title]) => {
                            return {id: +id, title}
                        })
                }
            })
    }

    public async getEvent(eventId: number): Promise<Event> {
        return await db.one(`
            SELECT cb.*
            FROM cb_events cb
            WHERE cb.id = $(eventId)
        `,
            {
                eventId
            });
    }

    public async loadImage(packId: number): Promise<Buffer> {
        const img = await this.db.one(`
            SELECT image
            FROM cb_events_packs p
            WHERE p.id = $1
        `, packId)
        return Buffer.from(img.image)
    }

    public async fetchAlreadyLoadedImages(): Promise<string[]> {
        return []
        // return await this.db.map(`
        //     SELECT image_src
        //     FROM cb_events_packs p
        // `, {}, r => r.image_src)
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

