import {
    PrimaryDataExtId,
    PrimaryDataId,
    UniversalDbSync,
    UniversalSyncDiff,
    UniversalSyncSavedDiff
} from '@culthub/universal-db-sync'
import { fieldStr, fieldTimestamptzNullable } from '@culthub/pg-utils'
import { ColumnSet, IColumnConfig, IDatabase, IMain, ITask } from 'pg-promise'
import { BaseSyncItemDbRow } from '@culthub/universal-db-sync/src/universal-db-sync'

export interface ParsedEvent {
    extId: string
    title: string
    category: string
    timetable: string
    place: string
    price: string
    description: string
    tags: string[]
    url: string
    parseUrl: string
    deletedAt?: Date
    updatedAt?: Date
}

export interface ParsedEventToSave extends PrimaryDataExtId {
    primaryData: ParsedEvent
    rawDates: string[]
}

export interface DbParsedEvent extends BaseSyncItemDbRow {
    ext_id: string
    category: string
    title: string
    timetable: string
    place: string
    price: string
    description: string
    tags: string[]
    url: string
    parse_url: string
    updated_at: Date
    deleted_at?: Date
}

const MD5_IGNORE: (keyof DbParsedEvent)[] = ['parse_url']

export const parsedEventColumnsDef: IColumnConfig<DbParsedEvent>[] = [
    fieldStr('ext_id'),
    fieldStr('title'),
    fieldStr('category'),
    fieldStr('timetable'),
    fieldStr('place'),
    fieldStr('price'),
    fieldStr('description'),
    fieldStr('tags'),
    fieldStr('url'),
    fieldStr('parse_url'),
    fieldTimestamptzNullable('updated_at'),
    fieldTimestamptzNullable('deleted_at'),
]

export type DeletedColumns = 'category' | 'title'

export interface ExtIdDates {
    extId: number
    dates: Date[]
}


export class ParsedEventRepository {
    readonly dbColParsedEvents: ColumnSet
    readonly syncCommon: UniversalDbSync<ParsedEventToSave, DbParsedEvent, DeletedColumns>

    constructor(private db: IDatabase<unknown>, private pgp: IMain) {
        this.dbColParsedEvents = new pgp.helpers.ColumnSet(parsedEventColumnsDef, {table: 'p_events'})

        this.syncCommon = new UniversalDbSync<ParsedEventToSave, DbParsedEvent, DeletedColumns>({
            table: 'p_events',
            columnsDef: parsedEventColumnsDef,
            ignoreColumns: MD5_IGNORE,
            mapToDbRow: ParsedEventRepository.mapToDb,
            deletedAuxColumns: ['category', 'title'],
            recoveredAuxColumns: ['category', 'title']
        }, pgp)
    }

    public async loadEventEntranceDates(extIds: string[], db: ITask<unknown>): Promise<ExtIdDates[]> {
        if (extIds.length === 0) {
            return []
        }
        return await db.map(`
            SELECT ext_id, timetable 
            FROM p_events pe
            WHERE pe.ext_id IN ($(extIds:csv)) 
        `, {extIds}, (row) => {
            return {
                extId: row.ext_id,
                dates: row.timetable
            }
        })
    }

    public async loadEventsByIds(ids: number[]): Promise<(ParsedEvent & { id: number })[]> {
        if (ids.length === 0) return []
        return await this.db.map(`
            SELECT 
                pe.id, pe.ext_id, pe.title, pe.category, pe.timetable, pe.place, pe.price, pe.description, pe.tags, pe.url, pe.parse_url
            FROM p_events pe
            WHERE pe.id IN ($(ids:csv)) 
        `, {ids}, ParsedEventRepository.mapFromDb)
    }

    public async prepareDiffForSync(newEvents: ParsedEventToSave[], db: ITask<unknown>): Promise<UniversalSyncDiff<ParsedEventToSave, DeletedColumns>> {
        return this.syncCommon.prepareDiffForSync(newEvents, db)
    }

    public async syncDiff(syncDiff: UniversalSyncDiff<ParsedEventToSave, DeletedColumns>, db: ITask<unknown>): Promise<UniversalSyncSavedDiff<ParsedEventToSave & PrimaryDataId, DeletedColumns>> {
        return await this.syncCommon.syncDiff(syncDiff, db)
    }

    private static mapToDb(event: ParsedEventToSave, updatedAt: Date): DbParsedEvent {
        return {
            title: event.primaryData.title,
            category: event.primaryData.category,
            ext_id: event.primaryData.extId,
            timetable: event.primaryData.timetable,
            place: event.primaryData.place,
            description: event.primaryData.description,
            tags: event.primaryData.tags,
            url: event.primaryData.url,
            price: event.primaryData.price,
            parse_url: event.primaryData.parseUrl,
            deleted_at: event.primaryData.deletedAt,
            updated_at: updatedAt,
        }
    }

    private static mapFromDb(row: DbParsedEvent & { id: number }): ParsedEvent & { id: number } {
        return {
            id: +row.id,
            title: row.title,
            category: row.category,
            extId: row.ext_id,
            timetable: row.timetable,
            price: row.price,
            place: row.place,
            description: row.description,
            tags: row.tags,
            url: row.url,
            deletedAt: row.deleted_at,
            updatedAt: row.updated_at,
            parseUrl: row.parse_url
        }
    }
}