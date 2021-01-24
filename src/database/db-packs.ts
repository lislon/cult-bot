import { Event, ExtIdAndId, MyInterval } from '../interfaces/app-interfaces'
import { mapToPgInterval, rangeHalfOpenIntersect } from './db-utils'
import { ColumnSet, IBaseProtocol, IDatabase, IMain, ITask } from 'pg-promise'
import { db, IExtensions } from './db'
import { zip } from 'lodash'
import { SELECT_ALL_EVENTS_FIELDS } from './db-events-common'

export interface EventPackForSave {
    title: string
    description: string
    author: string
    eventIds: number[]
    weight: number
}

export interface ScenePack {
    id: number
    title: string
    events: PackEventSummary[]
    description: string
}

export interface PackEventSummary {
    id: number
    title: string
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
            ], {table: 'cb_events_packs'})
    }

    public async sync(packs: EventPackForSave[], outerDbTx: IBaseProtocol<{}> = db): Promise<number[]> {
        return await outerDbTx.txIf({ reusable: true }, async (dbTx: ITask<IExtensions> & IExtensions) => {
            await dbTx.none('TRUNCATE cb_events_packs')
            if (packs.length > 0) {
                const s = this.pgp.helpers.insert(packs.map(p => {
                    return {
                        title: p.title,
                        description: p.description,
                        author: p.author,
                        weight: p.weight,
                        event_ids: p.eventIds,
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
                array_agg(pe.id) event_ids,
                array_agg(pe.title) event_titles
            from cb_events_packs p
            join (
                SELECT ${SELECT_ALL_EVENTS_FIELDS}
                FROM (
                    SELECT cbet.event_id, MIN(LOWER(cbet.entrance)) AS first_entrance
                    FROM cb_events_entrance_times cbet
                    JOIN cb_events_packs p on cbet.event_id = any (p.event_ids)
                    WHERE ${rangeHalfOpenIntersect('$(interval)::tstzrange', 'cbet.entrance')}
                    GROUP by cbet.event_id
                ) cbet
                JOIN cb_events cb ON cb.id = cbet.event_id
                WHERE cb.deleted_at IS NULL
                ORDER BY cb.is_anytime ASC, cbet.first_entrance ASC, cb.rating DESC, cb.title ASC
            ) pe on (pe.id = any(p.event_ids))
            GROUP BY p.id
            HAVING COUNT(pe.id) >= 2
            ORDER BY p.weight ASC, p.title ASC
            `, { interval: mapToPgInterval(query.interval) },
            r => {
                return {
                    id: +r.id,
                    title: r.title,
                    description: r.description,
                    events: zip<string, string>(r.event_ids, r.event_titles)
                        .map(([id, title]) => {
                            return {id: +id, title}
                        })
                }
            })
    }

    public async getEvent(eventId: number): Promise<Event> {
        return await db.one(`
            SELECT ${SELECT_ALL_EVENTS_FIELDS}
            FROM cb_events cb
            WHERE cb.id = $(eventId)
                  AND cb.deleted_at IS NULL
        `,
            {
                eventId
            });
    }

    public async fetchAllIdsExtIds(): Promise<ExtIdAndId[]> {
        return await this.db.map(`
            SELECT cb.id, cb.ext_id
            FROM cb_events cb
            WHERE cb.deleted_at IS NULL
            `, undefined, ({ id, ext_id}) => {
                return {id: +id, extId: ext_id}
            })
    }
}

