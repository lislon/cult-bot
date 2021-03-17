import { DateInterval, Event } from '../interfaces/app-interfaces'
import { mapToPgInterval, rangeHalfOpenIntersect } from './db-utils'
import { ColumnSet, IDatabase, IMain, ITask } from 'pg-promise'
import { db, IExtensions } from './db'
import { zip } from 'lodash'
import { mapEvent, SELECT_ALL_EVENTS_FIELDS } from './db-events-common'
import { SyncConfig, UniversalDbSync, UniversalSyncDiff, WithId } from '@culthub/universal-db-sync'
import { fieldInt, fieldInt8Array, fieldStr, fieldTimestamptzNullable } from '@culthub/pg-utils'
import { BaseSyncItemDbRow } from '@culthub/universal-db-sync'

export interface PackToSave {
    primaryData: {
        extId: string
        title: string
        description: string
        author: string
        eventIds: number[]
        weight: number
        hideIfLessThen: number
    }
    dateDeleted?: Date
}

export interface PackDb extends BaseSyncItemDbRow {
    id?: number
    ext_id: string
    title: string
    description: string
    author: string
    event_ids: number[]
    weight: number
    hide_if_less_then: number
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
export interface PacksListQuery {
    interval: DateInterval
}

export interface SinglePackQuery {
    packId: number
    interval: DateInterval
}

export interface PackRecovered extends PackToSave {
    old: {
        title: string
    }
}

type PackRecoveredColumns = 'title'

export type PacksSyncDiff = UniversalSyncDiff<PackToSave, PackRecoveredColumns>
export type PacksSyncDiffSaved = UniversalSyncDiff<WithId<PackToSave>, PackRecoveredColumns>

const packsColumnsDef = [
    fieldStr('title'),
    fieldStr('description'),
    fieldStr('ext_id'),
    fieldStr('author'),
    fieldInt8Array('event_ids'),
    fieldInt('weight'),
    fieldInt('hide_if_less_then'),
    fieldTimestamptzNullable('updated_at'),
    fieldTimestamptzNullable('deleted_at'),
]

function getOrderByEventsInPack(eventPrefix = 'cb', eventEntranceTimesPrefix = 'cbet') {
    return `${eventPrefix}.is_anytime ASC, ${eventEntranceTimesPrefix}.first_entrance ASC, ${eventPrefix}.rating DESC, ${eventPrefix}.title ASC`;
}

export class PacksRepository {
    readonly columns: ColumnSet

    readonly syncCommon: UniversalDbSync<PackToSave, PackDb, PackRecoveredColumns>

    constructor(private db: IDatabase<any>, private pgp: IMain) {
        this.columns = new pgp.helpers.ColumnSet(packsColumnsDef, {table: 'cb_events_packs'})

        const cfg: SyncConfig<PackToSave, PackDb, PackRecoveredColumns> = {
            table: 'cb_events_packs',
            columnsDef: packsColumnsDef,
            ignoreColumns: [],
            mapToDbRow: PacksRepository.mapToDb,
            deletedAuxColumns: ['title'],
            recoveredAuxColumns: ['title']
        }
        this.syncCommon = new UniversalDbSync(cfg, pgp)
    }

    public async syncDatabase(newPacks: PackToSave[]): Promise<PacksSyncDiffSaved> {
        return await this.db.tx('sync-pack', async (dbTx: ITask<IExtensions>) => {
            const syncDiff = await this.prepareDiffForSync(newPacks, dbTx)
            return await this.syncDiff(syncDiff, dbTx)
        })
    }


    public async prepareDiffForSync(newEvents: PackToSave[], db: ITask<IExtensions>): Promise<PacksSyncDiff> {
        return this.syncCommon.prepareDiffForSync(newEvents, db)
    }

    public async syncDiff(syncDiff: PacksSyncDiff, db: ITask<IExtensions>): Promise<PacksSyncDiffSaved> {
        return await this.syncCommon.syncDiff(syncDiff, db)
    }

    private static mapToDb(pack: PackToSave, updatedAt: Date): PackDb {
        return {
            ...pack.primaryData,
            event_ids: pack.primaryData.eventIds,
            ext_id: pack.primaryData.extId,
            updated_at: updatedAt,
            deleted_at: pack.dateDeleted,
            hide_if_less_then: pack.primaryData.hideIfLessThen
        }
    }

    public async getEventIdsByPackId(query: SinglePackQuery): Promise<number[]> {
        const {from, where, params} = this.prepareQueryBody(query)
        const rawRows = await this.db.any(`
            select pe.id, p.hide_if_less_then
            ${from}
            WHERE ${where} AND p.id = $(packId)
            ORDER BY ${getOrderByEventsInPack('pe', 'pe')}
        `, {...params, packId: query.packId })

        if (rawRows.length > 0 && rawRows.length < +rawRows[0].hide_if_less_then) {
            return []
        }
        return rawRows.map(raw => +raw.id)
    }

    public async listPacks(query: PacksListQuery): Promise<ScenePack[]> {
        const {from, where, params} = this.prepareQueryBody(query)
        return await this.db.map(`
            SELECT
                p.id,
                p.title,
                p.description,
                array_agg(pe.id) event_ids,
                array_agg(pe.title) event_titles
            ${from}
            WHERE ${where}
            GROUP BY p.id
            HAVING COUNT(pe.id) >= p.hide_if_less_then
            ORDER BY p.weight ASC, p.title ASC
            `, params,
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

    private prepareQueryBody(query: { interval: DateInterval }): { from: string; where: string, params: { interval: string } } {
        const from = `from cb_events_packs p
            join (
                SELECT ${SELECT_ALL_EVENTS_FIELDS}, cbet.first_entrance
                FROM (
                    SELECT cbet.event_id, MIN(LOWER(cbet.entrance)) AS first_entrance
                    FROM cb_events_entrance_times cbet
                    JOIN cb_events_packs p on cbet.event_id = any (p.event_ids)
                    WHERE ${rangeHalfOpenIntersect('$(interval)::tstzrange', 'cbet.entrance')}
                    GROUP by cbet.event_id
                ) cbet
                JOIN cb_events cb ON cb.id = cbet.event_id
                WHERE cb.deleted_at IS NULL
                ORDER BY ${getOrderByEventsInPack('cb', 'cbet')}
            ) pe on (pe.id = any(p.event_ids))`
        const where = `p.deleted_at IS NULL`
        const params = { interval: mapToPgInterval(query.interval) }
        return {from, where, params}
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
}

