import { ColumnSet, IDatabase, IMain, ITask } from 'pg-promise'
import { IExtensions } from './db'
import { BaseSyncItemDbRow, SyncConfig, UniversalDbSync, UniversalSyncDiff, WithId } from '@culthub/universal-db-sync'
import { fieldInt, fieldStr, fieldTimestamptzNullable, fieldBoolean } from '@culthub/pg-utils'

export interface PlaceToSave {
    primaryData: {
        extId: string
        parentTitle: string
        title: string
        address: string
        yandexAddress: string
        tag: string
        url: string
        isComfort: boolean
    }
    dateDeleted?: Date
}
export interface PlaceDb extends BaseSyncItemDbRow {
    parent_title: string
    title: string
    address: string
    yandex_map: string
    tag: string
    url: string
    is_comfort: boolean
}

type PlaceRecoveredColumns = 'title'

export type PlacesSyncDiff = UniversalSyncDiff<PlaceToSave, PlaceRecoveredColumns>
export type PlacesSyncDiffSaved = UniversalSyncDiff<WithId<PlaceToSave>, PlaceRecoveredColumns>

const placesColumnsDef = [
    fieldStr('parent_title'),
    fieldStr('title'),
    fieldStr('address'),
    fieldStr('yandex_map'),
    fieldStr('tag'),
    fieldStr('url'),
    fieldBoolean('is_comfort'),
    fieldTimestamptzNullable('updated_at'),
    fieldTimestamptzNullable('deleted_at'),
]

export class PlacesRepository {
    readonly columns: ColumnSet

    readonly syncCommon: UniversalDbSync<PlaceToSave, PlaceDb, PlaceRecoveredColumns>

    constructor(private db: IDatabase<any>, private pgp: IMain) {
        const cfg: SyncConfig<PlaceToSave, PlaceDb, PlaceRecoveredColumns> = {
            table: 'cb_places',
            columnsDef: placesColumnsDef,
            ignoreColumns: [],
            mapToDbRow: PlacesRepository.mapToDb,
            deletedAuxColumns: ['title'],
            recoveredAuxColumns: ['title']
        }
        this.syncCommon = new UniversalDbSync(cfg, pgp)
        this.columns = new pgp.helpers.ColumnSet(placesColumnsDef, {table: cfg.table })
    }

    public async syncDatabase(newPacks: PlaceToSave[]): Promise<PlacesSyncDiffSaved> {
        return await this.db.tx('sync-places', async (dbTx: ITask<IExtensions>) => {
            const syncDiff = await this.prepareDiffForSync(newPacks, dbTx)
            return await this.syncDiff(syncDiff, dbTx)
        })
    }

    public async prepareDiffForSync(newEvents: PlaceToSave[], db: ITask<IExtensions>): Promise<PlacesSyncDiff> {
        return this.syncCommon.prepareDiffForSync(newEvents, db)
    }

    public async syncDiff(syncDiff: PlacesSyncDiff, db: ITask<IExtensions>): Promise<PlacesSyncDiffSaved> {
        return await this.syncCommon.syncDiff(syncDiff, db)
    }

    private static mapToDb(pack: PlaceToSave, updatedAt: Date): PlaceDb {
        return {
            parent_title: pack.primaryData.parentTitle,
            ext_id: pack.primaryData.title,
            title: pack.primaryData.title,
            address: pack.primaryData.address,
            is_comfort: pack.primaryData.isComfort,
            tag: pack.primaryData.tag,
            url: pack.primaryData.url,
            yandex_map: pack.primaryData.yandexAddress,
            updated_at: updatedAt,
            deleted_at: pack.dateDeleted
        }
    }

}

