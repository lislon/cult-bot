import { Event, ExtIdAndId, DateInterval } from '../interfaces/app-interfaces'
import {
    mapToPgInterval,
    rangeHalfOpenIntersect
} from './db-utils'
import { ColumnSet, IDatabase, IMain, ITask } from 'pg-promise'
import { db, IExtensions } from './db'
import { zip } from 'lodash'
import { mapEvent, SELECT_ALL_EVENTS_FIELDS } from './db-events-common'
import {
    BaseSyncItemDbRow,
    BaseSyncItemDeleted,
    BaseSyncItemToSave, SyncConfig,
    UniversalDbSync,
    UniversalSyncDiff
} from '@culthub/universal-db-sync'
import { fieldInt, fieldInt8Array, fieldStr, fieldTimestamptzNullable } from '@culthub/pg-utils'

export interface PackToSave extends BaseSyncItemToSave {
    primaryData: {
        id?: number
        extId: string
        title: string
        description: string
        author: string
        eventIds: number[]
        weight: number
    }
    dateDeleted?: Date | null
}

export interface PackDb extends BaseSyncItemDbRow {
    id?: number
    ext_id: string
    title: string
    description: string
    author: string
    event_ids: number[]
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
    interval: DateInterval
}

export interface PackRecovered extends PackToSave {
    old: {
        title: string
    }
}

export interface PackDeleted extends BaseSyncItemDeleted {
    title: string
}

export type PacksSyncDiff = UniversalSyncDiff<PackToSave, PackDeleted, PackRecovered>

const packsColumnsDef = [
    fieldStr('title'),
    fieldStr('description'),
    fieldStr('ext_id'),
    fieldStr('author'),
    fieldInt8Array('event_ids'),
    fieldInt('weight'),
    fieldTimestamptzNullable('updated_at'),
    fieldTimestamptzNullable('deleted_at'),
]


export class PacksRepository {
    readonly columns: ColumnSet

    readonly syncCommon: UniversalDbSync<PackToSave, PackDeleted, PackRecovered, PackDb>

    constructor(private db: IDatabase<any>, private pgp: IMain) {
        this.columns = new pgp.helpers.ColumnSet(packsColumnsDef, {table: 'cb_events_packs'})

        const cfg: SyncConfig<PackToSave, PackDb> = {
            table: 'cb_events_packs',
            columnsDef: packsColumnsDef,
            ignoreColumns: [],
            mapToDbRow: PacksRepository.mapToDb,
            deletedAuxColumns: ['title'],
            recoveredAuxColumns: ['title']
        }
        this.syncCommon = new UniversalDbSync(cfg, pgp)
    }

    public async syncDatabase(newPacks: PackToSave[]): Promise<PacksSyncDiff> {
        return await this.db.tx('sync-pack', async (dbTx: ITask<IExtensions>) => {
            const syncDiff = await this.prepareDiffForSync(newPacks, dbTx)
            await this.syncDiff(syncDiff, dbTx)
            return syncDiff
        })
    }


    public async prepareDiffForSync(newEvents: PackToSave[], db: ITask<IExtensions>): Promise<PacksSyncDiff> {
        return this.syncCommon.prepareDiffForSync(newEvents, db)
    }

    public async syncDiff(syncDiff: PacksSyncDiff, db: ITask<IExtensions>): Promise<PacksSyncDiff> {
        return await this.syncCommon.syncDiff(syncDiff, db)
    }

    private static mapToDb(pack: PackToSave, updatedAt: Date): PackDb {
        return {
            ...pack.primaryData,
            event_ids: pack.primaryData.eventIds,
            ext_id: pack.primaryData.extId,
            updated_at: updatedAt,
            deleted_at: pack.dateDeleted
        }
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
            WHERE p.deleted_at IS NULL
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
            WHERE cb.id = $(eventId) AND cb.deleted_at IS NULL
        `,
            {
                eventId
            }, mapEvent)
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

