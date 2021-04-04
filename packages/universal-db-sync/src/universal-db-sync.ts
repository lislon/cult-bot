import { ColumnSet, IColumnConfig, IMain, ITask } from 'pg-promise'
import md5 from 'md5'
import { keyBy, merge } from 'lodash'

export interface PrimaryDataExtId {
    primaryData: {
        extId: string
    }
}

export interface PrimaryDataId {
    primaryData: {
        id: number
    }
}

export interface PrimaryDataMaybeId {
    primaryData: {
        id?: number
    }
}

//
// export interface BaseSyncItemDeleted {
//     id: number
//     extId: string
// }

// export interface BaseSyncItemToSave {
//     primaryData: {
//         id?: number
//         extId: string
//     }
// }

export interface PrimaryDataTitle {
    old: {
        title: string
    }
}

export interface BaseSyncItemDbRow {
    ext_id: string
    updated_at: Date
    deleted_at?: Date
}
export type WithId<E> = E & PrimaryDataId
export type WithMaybeId<E> = E & PrimaryDataMaybeId

export type Recovered<E extends PrimaryDataExtId, RECOVERED_COLUMNS extends string> =
    WithId<E>
    & { old: Record<RECOVERED_COLUMNS, string> }

export interface Deleted<RECOVERED_COLUMNS extends string> extends PrimaryDataExtId, PrimaryDataId {
    primaryData: {
        id: number
        extId: string
    }
    old: Record<RECOVERED_COLUMNS, string>
}

export interface UniversalSyncDiff<E extends PrimaryDataExtId, RECOVERED_COLUMNS extends string> {
    updated: WithId<E>[],
    inserted: E[],
    notChanged: WithId<E>[],
    deleted: Deleted<RECOVERED_COLUMNS>[],
    recovered: Recovered<E, RECOVERED_COLUMNS>[]
}

export interface UniversalSyncSavedDiff<E extends PrimaryDataExtId, RECOVERED_COLUMNS extends string> {
    updated: WithId<E>[],
    inserted: WithId<E>[],
    notChanged: WithId<E>[],
    deleted: Deleted<RECOVERED_COLUMNS>[],
    recovered: Recovered<E, RECOVERED_COLUMNS>[]
}

export interface SyncConfig<E extends PrimaryDataExtId, DBE extends BaseSyncItemDbRow, RECOVERED_COLUMNS extends keyof DBE> {
    table: string
    columnsDef: IColumnConfig<DBE>[],
    ignoreColumns: (keyof DBE)[],
    mapToDbRow: (event: E, updatedAt: Date) => DBE,
    deletedAuxColumns: RECOVERED_COLUMNS[]
    recoveredAuxColumns: RECOVERED_COLUMNS[]
}

export class UniversalDbSync<E extends PrimaryDataExtId, DBE extends BaseSyncItemDbRow, RECOVERED_COLUMNS extends keyof DBE & string> {
    readonly cfg: SyncConfig<E, DBE, RECOVERED_COLUMNS>
    readonly dbColEvents: ColumnSet

    constructor(cfg: SyncConfig<E, DBE, RECOVERED_COLUMNS>, private pgp: IMain) {
        this.cfg = cfg
        this.dbColEvents = new pgp.helpers.ColumnSet(cfg.columnsDef, {table: cfg.table})
    }

    public async prepareDiffForSync(newEvents: E[], db: ITask<unknown>): Promise<UniversalSyncDiff<E, RECOVERED_COLUMNS>> {

        const result: UniversalSyncDiff<E, RECOVERED_COLUMNS> = {
            updated: [],
            inserted: [],
            notChanged: [],
            deleted: [],
            recovered: []
        }
        const now = new Date()

        await db.txIf(async (dbTx: ITask<unknown>) => {

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
                const newRow: DBE = this.cfg.mapToDbRow(newEvent, now)
                const existingMd5 = extIdToChecksum.get(newEvent.primaryData.extId)
                if (existingMd5 === undefined) {
                    maybeinserted.push(newEvent)
                } else if (existingMd5 != md5(this.postgresConcat(newRow))) {
                    const e: E & PrimaryDataId = merge({}, newEvent, {primaryData: {id: +extIdToId.get(newEvent.primaryData.extId)}})
                    result.updated.push(e)

                    // const old = existingIdsRaw.find(e => e['extid'] === newEvent.primaryData.extId)['md5text']
                    // const new2 = this.postgresConcat(newRow)
                    // logger.silly('problem md5?')
                    // logger.silly(old)
                    // logger.silly(new2)

                } else {
                    const e = merge({}, newEvent, ({primaryData: {id: +existingIdsRaw.find(e => e['extid'] === newEvent.primaryData.extId).id}}))
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
                }, (row) => ({ primaryData: { extId: row.extid, id: +row.id }, old: row}))
            }

            if (maybeinserted.length > 0) {
                const rawRecovered = await dbTx.map(`
                        SELECT id,
                               ext_id AS extid,
                               $(columns:name)
                        FROM $(tableName:name)
                        WHERE deleted_at IS NOT NULL AND ext_id IN ($(extIds:csv))
                        `, {
                    tableName: this.cfg.table,
                    columns: this.cfg.recoveredAuxColumns,
                    extIds: maybeinserted.map(e => e.primaryData.extId)
                }, ((row): { old: Record<RECOVERED_COLUMNS, string>, id: number, extId: string }  => {
                    return {
                        id: +row.id,
                        extId: row.extid,
                        old: row
                    }
                }))

                const deletedByExtId = keyBy(rawRecovered, 'extId')

                maybeinserted.forEach((e: E) => {
                    const recoveredEvent = deletedByExtId[e.primaryData.extId]
                    if (recoveredEvent !== undefined) {
                        const recoveredItem: Recovered<E, RECOVERED_COLUMNS> = merge({}, e, {
                                primaryData: {
                                    id: recoveredEvent.id,
                                },
                                old: recoveredEvent.old
                            }
                        )
                        result.recovered.push(recoveredItem)
                    } else {
                        result.inserted.push(e)
                    }
                })
            }
        })
        return result
    }

    public async syncDiff(syncDiff: UniversalSyncDiff<E, RECOVERED_COLUMNS>, db: ITask<unknown>): Promise<UniversalSyncSavedDiff<E & PrimaryDataId, RECOVERED_COLUMNS>> {
        const now = new Date()

        const newDbRows = syncDiff.inserted.map(e => this.cfg.mapToDbRow(e, now))

        const updatedAndRecoveredRows: (DBE & { id: number })[] = [...syncDiff.updated, ...syncDiff.recovered]
            .map(e => {
                if (e.primaryData.id === undefined) {
                    throw new Error('Should not happen on ' + JSON.stringify(e.primaryData))
                }
                return {...(this.cfg.mapToDbRow(e, now)), id: e.primaryData.id}
            })


        return await db.txIf({reusable: true}, async (dbTx: ITask<unknown>): Promise<UniversalSyncSavedDiff<E & PrimaryDataId, RECOVERED_COLUMNS>> => {

            if (updatedAndRecoveredRows.length > 0) {
                const s = this.pgp.helpers.update(updatedAndRecoveredRows, this.dbColEvents.merge(['?id'])) + ' WHERE v.id = t.id'
                await dbTx.none(s)
            }

            await this.deleteEvents(dbTx, syncDiff.deleted, now)
            const newEventsId = await this.insertNewItems(dbTx, newDbRows)

            return {
                inserted: syncDiff.inserted.map((createdEvent, index) => merge({}, createdEvent, {
                        primaryData: {
                            id: newEventsId[index]
                        }
                    }
                )),
                deleted: syncDiff.deleted,
                notChanged: syncDiff.notChanged,
                recovered: syncDiff.recovered,
                updated: syncDiff.updated
            }
        })
    }

    private async deleteEvents(dbTx: ITask<unknown>, deleted: WithId<unknown>[], dateDeleted: Date) {
        if (deleted.length > 0) {
            const s = this.pgp.helpers.update({
                deleted_at: dateDeleted,
            }, this.dbColEvents) + ' WHERE id IN ($1:csv)'
            const eventIds = deleted.map(e => e.primaryData.id)
            await dbTx.none(s, [eventIds])
        }
    }

    private async insertNewItems(dbTx: ITask<unknown>, newDbRows: DBE[]): Promise<number[]> {
        if (newDbRows.length === 0) return []
        const s = this.pgp.helpers.insert(newDbRows, this.dbColEvents) + ' RETURNING id'
        return await dbTx.map(s, [], r => +r.id)
    }

    private getMd5Columns(): (keyof DBE)[] {
        return this.cfg.columnsDef
            .map((c: IColumnConfig<DBE> | string) => (typeof c === 'string' ? c : c.name) as keyof DBE)
            .filter(n => ![...this.cfg.ignoreColumns, 'updated_at', 'deleted_at'].includes(n))
    }

    private buildPostgresMd5EventsExpression(prefix: string | undefined = undefined): string {
        return `json_build_array(${(this.getMd5Columns().map(c => prefix ? prefix + '.' + c : c)).join(',')})`
    }

    private postgresConcat(event: DBE) {
        function formatDateZ(date: Date): string {
            const isoDate = date.toISOString()
            return `${isoDate.substr(0, 10)}T${isoDate.substr(11, 8)}+00:00`
        }

        function mapToType(value: DBE[keyof DBE] | boolean | string): string {
            if (typeof value === 'string') {
                return JSON.stringify(value)
            } else if (typeof value === 'boolean') {
                return value ? 'true' : 'false'
            } else if (value instanceof Date) {
                return JSON.stringify(formatDateZ(value))
            } else {
                return '' + value
            }
        }

        const s = this.getMd5Columns().map(key => {
            const element: DBE[keyof DBE] = event[key]
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