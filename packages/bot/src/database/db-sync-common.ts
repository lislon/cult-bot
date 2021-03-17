import { ColumnSet, IColumnConfig, IMain, ITask } from 'pg-promise'
import { IExtensions } from './db'
import md5 from 'md5'
import { logger } from '../util/logger'
import { keyBy } from 'lodash'
import { BaseSyncItemDbRow } from '@culthub/universal-db-sync'

export interface BaseSyncItemDeleted {
    id: number
    extId: string
}

export interface BaseSyncItemToSave {
    primaryData: {
        id?: number
        extId: string
    }
}

export type BaseSyncItemToRecover = {
    old: {
        title: string
    }
}

export interface UniversalSyncDiff<E extends BaseSyncItemToSave, DE extends BaseSyncItemDeleted, RE extends E & BaseSyncItemToRecover> {
    updated: E[],
    inserted: E[],
    notChanged: E[],
    deleted: DE[],
    recovered: RE[]
}

export interface SyncConfig<E extends BaseSyncItemToSave, DE extends BaseSyncItemDeleted, RE extends E & BaseSyncItemToRecover, DBE extends BaseSyncItemDbRow> {
    table: string
    columnsDef: IColumnConfig<E>[],
    ignoreColumns: (keyof DBE)[],
    mapToDbRow: (event: E, updatedAt: Date) => DBE,
    deletedAuxColumns: (keyof DBE)[]
    recoveredAuxColumns: (keyof DBE)[]
}

export class DbSyncCommon<E extends BaseSyncItemToSave, DE extends BaseSyncItemDeleted, RE extends E & BaseSyncItemToRecover, DBE extends BaseSyncItemDbRow> {
    readonly cfg: SyncConfig<E, DE, RE, DBE>
    readonly dbColEvents: ColumnSet

    constructor(cfg: SyncConfig<E, DE, RE, DBE>, private pgp: IMain) {
        this.cfg = cfg
        this.dbColEvents = new pgp.helpers.ColumnSet(cfg.columnsDef, {table: cfg.table})
    }

    public async prepareDiffForSync(newEvents: E[], db: ITask<IExtensions>): Promise<UniversalSyncDiff<E, DE, RE>> {

        const result: UniversalSyncDiff<E, DE, RE> = {
            updated: [],
            inserted: [],
            notChanged: [],
            deleted: [],
            recovered: []
        }
        const now = new Date()

        await db.txIf(async (dbTx: ITask<IExtensions>) => {

            const existingIdsRaw = await dbTx.manyOrNone(`
                    SELECT id,
                           ext_id AS extid,
                           ${this.buildPostgresMd5EventsExpression()}::TEXT AS md5text,
                           MD5(${this.buildPostgresMd5EventsExpression()}::TEXT) AS md5
                    FROM $(tableName:name)
                    WHERE deleted_at IS NULL
                    `, {tableName: this.cfg.table})

            const extIdToChecksum = new Map()
            const extIdToId = new Map()
            const removedEventExtIds = new Set()

            existingIdsRaw.forEach(({id, extid, md5}) => {
                extIdToChecksum.set(extid, md5)
                extIdToId.set(extid, id)
                removedEventExtIds.add(extid)
            })

            const maybeinserted: E[] = []

            newEvents.forEach((newEvent) => {
                const newRow = this.cfg.mapToDbRow(newEvent, now)
                const existingMd5 = extIdToChecksum.get(newEvent.primaryData.extId)
                if (existingMd5 === undefined) {
                    maybeinserted.push(newEvent)
                } else if (existingMd5 != md5(this.postgresConcat(newRow))) {
                    const e = {...newEvent}
                    e.primaryData.id = +extIdToId.get(newEvent.primaryData.extId)
                    result.updated.push(e)

                    const old = existingIdsRaw.find(e => e['extid'] === newEvent.primaryData.extId)['md5text']
                    const new2 = this.postgresConcat(newRow)
                    logger.silly('problem md5?')
                    logger.silly(old)
                    logger.silly(new2)

                } else {
                    const e = {...newEvent}
                    e.primaryData.id = +existingIdsRaw.find(e => e['extid'] === newEvent.primaryData.extId).id
                    result.notChanged.push(e)
                }
                removedEventExtIds.delete(newEvent.primaryData.extId)
            })

            if (removedEventExtIds.size > 0) {
                result.deleted = await dbTx.map(`
                    SELECT id, ext_id AS extid, $(columns:name)
                    FROM $(tableName:name)
                    WHERE ext_id IN ($(removedIds:csv)) AND deleted_at IS NULL`, {
                    tableName: this.cfg.table,
                    columns: this.cfg.deletedAuxColumns,
                    removedIds: Array.from(removedEventExtIds)
                }, (row) => ({...row, extId: row.extid, id: +row.id}))
            }

            if (maybeinserted.length > 0) {
                const recovered = await dbTx.map(`
                        SELECT id,
                               ext_id AS extid,
                               $(columns:name)
                        FROM $(tableName:name)
                        WHERE deleted_at IS NOT NULL AND ext_id IN ($(extIds:csv))
                        `, {
                    tableName: this.cfg.table,
                    columns: this.cfg.recoveredAuxColumns,
                    extIds: maybeinserted.map(e => e.primaryData.extId)
                    // extIds: maybeinserted.map(e => ({
                    //     toPostgres: () => this.pgp.as.text(e.primaryData.extId),
                    //     rawType: true
                    // }))
                }, ((row) => ({...row, extId: row.extid, id: +row.id})))

                const deletedByExtId = keyBy<{ id: number, title: string }>(recovered, 'extid')

                maybeinserted.forEach((e: E) => {
                    const recoveredEvent = deletedByExtId[e.primaryData.extId]
                    if (recoveredEvent !== undefined) {
                        const recoveredItem: RE = { ...e, ...{
                            old: {
                                title: recoveredEvent.title
                            }
                        }} as RE
                        recoveredItem.primaryData.id = recoveredEvent.id
                        result.recovered.push(recoveredItem)
                    } else {
                        result.inserted.push(e)
                    }
                })
            }
        })
        return result
    }

    public async syncDiff(syncDiff: UniversalSyncDiff<E, DE, RE>, db: ITask<IExtensions>): Promise<UniversalSyncDiff<E, DE, RE>> {
        const now = new Date()

        const newDbRows = syncDiff.inserted.map(e => this.cfg.mapToDbRow(e, now))

        const updatedAndRecoveredRows: (DBE & { id: number })[] = [...syncDiff.updated, ...syncDiff.recovered]
            .map(e => {
                return {...(this.cfg.mapToDbRow(e, now)), id: e.primaryData.id}
            })

        return await db.txIf({reusable: true}, async (dbTx: ITask<IExtensions>) => {

            await this.deleteEvents(dbTx, syncDiff.deleted, now)

            if (newDbRows.length > 0) {
                const newEventsId = await this.insertNewItems(dbTx, newDbRows)
                syncDiff.inserted.forEach((createdEvent, index) => {
                    createdEvent.primaryData.id = newEventsId[index]
                })
            }

            if (updatedAndRecoveredRows.length > 0) {
                const s = this.pgp.helpers.update(updatedAndRecoveredRows, this.dbColEvents.merge(['?id'])) + ' WHERE v.id = t.id'
                await dbTx.none(s)
            }

            return syncDiff
        })
    }

    private async deleteEvents(dbTx: ITask<IExtensions>, deleted: DE[], dateDeleted: Date) {
        if (deleted.length > 0) {
            const s = this.pgp.helpers.update({
                deleted_at: dateDeleted,
            }, this.dbColEvents) + ' WHERE id IN ($1:csv)'
            const eventIds = deleted.map(e => e.id)
            await dbTx.none(s, [eventIds])
        }
    }

    private async insertNewItems(dbTx: ITask<IExtensions>, newDbRows: DBE[]) {
        const s = this.pgp.helpers.insert(newDbRows, this.dbColEvents) + ' RETURNING id'
        return await dbTx.map(s, [], r => +r.id)
    }

    private getMd5Columns(): (keyof DBE)[] {
        return this.cfg.columnsDef
            .map(c => (typeof c === 'string' ? c : c.name) as keyof DBE)
            .filter(n => ![...this.cfg.ignoreColumns, 'updated_at', 'deleted_at'].includes(n))
    }

    private buildPostgresMd5EventsExpression(prefix: string = undefined): string {
        return `json_build_array(${(this.getMd5Columns().map(c => prefix ? prefix + '.' + c : c)).join(',')})`
    }

    private postgresConcat(event: DBE) {
        function mapToType(value: any): string {
            if (typeof value === 'string') {
                return JSON.stringify(value)
            } else if (typeof value === 'boolean') {
                return value ? 'true' : 'false'
            } else {
                return value
            }
        }

        const s = this.getMd5Columns().map(key => {
            const element = event[key]
            if (Array.isArray(element)) {
                return '[' + element.map(q => mapToType(q)).join(',') + ']'
            } else {
                return mapToType(element)
            }
        })
            .join(', ')
        return `[${s}]`
    }

}