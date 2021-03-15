import { BaseSyncItemDeleted, BaseSyncItemToSave, UniversalDbSync, UniversalSyncDiff } from '@culthub/universal-db-sync'
import { fieldStr, fieldTimestamptzNullable } from '@culthub/pg-utils'
import { ColumnSet, IColumnConfig, IDatabase, IMain, ITask } from 'pg-promise'

export interface ParsedEventDeleted extends BaseSyncItemDeleted {
    category: string
    title: string
}

export interface ParsedEventToRecover extends ParsedEventToSave {
    old: {
        title: string
    }
}

export interface ParsedEvent {
    id: number
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
    deletedAt: Date | null
    updatedAt: Date | null
}

export interface ParsedEventToSave extends BaseSyncItemToSave {
    primaryData: Omit<ParsedEvent, 'id'>
    rawDates: string[]
}

export interface DbParsedEvent {
    ext_id: string
    category: string
    title: string
    timetable: string
    place: string
    description: string
    tags: string[]
    url: string
    parse_url: string
    updated_at: Date
    deleted_at: Date | null
}

export type EventsSyncDiff = UniversalSyncDiff<ParsedEventToSave, ParsedEventDeleted, ParsedEventToRecover>

const MD5_IGNORE: (keyof DbParsedEvent)[] = ['parse_url']

export const parsedEventColumnsDef: IColumnConfig<DbParsedEvent>[] = [
    fieldStr('ext_id'),
    fieldStr('title'),
    fieldStr('category'),
    fieldStr('timetable'),
    fieldStr('place'),
    fieldStr('description'),
    fieldStr('tags'),
    fieldStr('url'),
    fieldStr('parse_url'),
    fieldTimestamptzNullable('updated_at'),
    fieldTimestamptzNullable('deleted_at'),
]

export interface ExtIdDates {
    extId: number
    dates: Date[]
}


export class ParsedEventRepository {
    readonly dbColParsedEvents: ColumnSet
    readonly syncCommon: UniversalDbSync<ParsedEventToSave, ParsedEventDeleted, ParsedEventToRecover, DbParsedEvent>

    constructor(private db: IDatabase<unknown>, private pgp: IMain) {
        this.dbColParsedEvents = new pgp.helpers.ColumnSet(parsedEventColumnsDef, {table: 'p_events'})

        this.syncCommon = new UniversalDbSync({
            table: 'p_events',
            columnsDef: parsedEventColumnsDef,
            ignoreColumns: MD5_IGNORE,
            mapToDbRow: ParsedEventRepository.mapToDb,
            deletedAuxColumns: ['category', 'title'],
            recoveredAuxColumns: ['title']
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
        `, { extIds }, (row) => {
            return {
                extId: row.ext_id,
                dates: row.timetable
            }
        })
    }

    public async prepareDiffForSync(newEvents: ParsedEventToSave[], db: ITask<unknown>): Promise<EventsSyncDiff> {
        return this.syncCommon.prepareDiffForSync(newEvents, db)
    }

    public async syncDiff(syncDiff: EventsSyncDiff, db: ITask<unknown>): Promise<EventsSyncDiff> {
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
            parse_url: event.primaryData.parseUrl,
            deleted_at: event.primaryData.deletedAt,
            updated_at: updatedAt,
        }
    }
}