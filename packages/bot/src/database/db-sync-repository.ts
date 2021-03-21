import { DbEvent, EventToSave } from '../interfaces/db-interfaces'
import { encodeTagsLevel1 } from '../util/tag-level1-encoder'
import { ColumnSet, IDatabase, IMain, ITask } from 'pg-promise'
import { db, IExtensions } from './db'
import { MomentIntervals } from '@culthub/timetable'
import { Recovered, SyncConfig, UniversalDbSync, UniversalSyncDiff, WithId } from '@culthub/universal-db-sync'
import { fieldInt, fieldStr, fieldTextArray, fieldTimestamptzNullable } from '@culthub/pg-utils'
import { TagLevel2 } from '../interfaces/app-interfaces'
import { EventCategory } from '@culthub/interfaces'

function generateRandomOrder() {
    return Math.ceil(Math.random() * 1000000)
}

export type EventToRecover = Recovered<EventToSave, EventDeletedColumns>
export type EventDeletedColumns = 'title' | 'category'

export type EventsSyncDiff = UniversalSyncDiff<EventToSave, EventDeletedColumns>
export type EventsSyncDiffSaved = UniversalSyncDiff<WithId<EventToSave>, EventDeletedColumns>

export interface EventForRefresh {
    id: number
    category: EventCategory
    tagLevel2: TagLevel2[]
    timetable: string
    lastDate: Date
}

interface DbEventEntranceRow {
    event_id: number,
    entrance: string
}

export interface EventIntervalForSave {
    eventId: number
    timeIntervals: MomentIntervals
}

const MD5_IGNORE: (keyof DbEvent)[] = ['order_rnd']

function getMd5Columns(): (keyof DbEvent)[] {
    const md5Columns = eventColumnsDef
        .map(c => (typeof c === 'string' ? c : c.name) as keyof DbEvent)
        .filter(n => !MD5_IGNORE.includes(n))
    return md5Columns as (keyof DbEvent)[]
}

export function buildPostgresMd5EventsExpression(prefix: string = undefined): string {
    return `json_build_array(${(getMd5Columns().map(c => prefix ? prefix + '.' + c : c)).join(',')})`
}

// type BaseOfDbObject = { [key: string]: unknown }


export const eventColumnsDef = [
    fieldStr('category'),
    fieldStr('title'),
    fieldStr('place'),
    fieldStr('address'),
    fieldStr('geotag'),
    fieldStr('timetable'),
    fieldStr('duration'),
    fieldStr('price'),
    fieldStr('notes'),
    fieldStr('description'),
    fieldStr('url'),
    fieldTextArray('tag_level_1'),
    fieldTextArray('tag_level_2'),
    fieldTextArray('tag_level_3'),
    fieldInt('rating'),
    fieldStr('reviewer'),
    fieldStr('is_anytime'),
    fieldInt('order_rnd'),
    fieldStr('ext_id'),
    fieldTimestamptzNullable('updated_at'),
    fieldTimestamptzNullable('deleted_at'),
    fieldInt('likes_fake'),
    fieldInt('dislikes_fake'),
]

type TagUpdate = { id: number, tagLevel2: TagLevel2[] }

export class EventsSyncRepository {
    readonly dbColIntervals: ColumnSet
    readonly dbColEvents: ColumnSet
    readonly dbColUpdateTagLevel2: ColumnSet
    readonly syncCommon: UniversalDbSync<EventToSave, DbEvent, EventDeletedColumns>

    constructor(private db: IDatabase<unknown>, private pgp: IMain) {
        this.dbColIntervals = new pgp.helpers.ColumnSet(['event_id', 'entrance'], {table: 'cb_events_entrance_times'})
        this.dbColEvents = new pgp.helpers.ColumnSet(eventColumnsDef, {table: 'cb_events'})
        this.dbColUpdateTagLevel2 = new pgp.helpers.ColumnSet(
            eventColumnsDef.filter(s => s.name === 'tag_level_2'),
            {table: 'cb_events'}).merge(['?id'])



        const cfg: SyncConfig<EventToSave, DbEvent, EventDeletedColumns> = {
            table: 'cb_events',
            columnsDef: eventColumnsDef,
            ignoreColumns: MD5_IGNORE,
            mapToDbRow: EventsSyncRepository.mapToDb,
            deletedAuxColumns: ['category', 'title'],
            recoveredAuxColumns: ['category', 'title']
        }
        this.syncCommon = new UniversalDbSync(cfg, pgp)
    }

    public async syncDatabase(newEvents: EventToSave[]): Promise<EventsSyncDiffSaved> {
        return await this.db.tx('sync-events', async (dbTx: ITask<IExtensions>) => {
            const syncDiff = await this.prepareDiffForSync(newEvents, dbTx)
            return await this.syncDiff(syncDiff, dbTx)
        })
    }


    public async prepareDiffForSync(newEvents: EventToSave[], db: ITask<IExtensions>): Promise<EventsSyncDiff> {
        return this.syncCommon.prepareDiffForSync(newEvents, db)
    }

    public async syncDiff(syncDiff: EventsSyncDiff, db: ITask<IExtensions>): Promise<EventsSyncDiffSaved> {
        const syncDiffWithIds = await this.syncCommon.syncDiff(syncDiff, db)
        const eventsIntervalToSync: EventIntervalForSave[] =
            [...syncDiffWithIds.updated, ...syncDiffWithIds.recovered, ...syncDiffWithIds.inserted]
                .map(({primaryData, timeIntervals}) => {
                    return {eventId: primaryData.id, timeIntervals}
                })

        await this.syncEventIntervals(eventsIntervalToSync, db)
        return syncDiffWithIds
    }

    public async shuffle(): Promise<void> {
        await db.none(`
            UPDATE cb_events
            SET order_rnd = CEIL(random() * 1000000)
            WHERE deleted_at IS NULL
        `)
    }

    public async getEventsForRefresh(): Promise<EventForRefresh[]> {
        return await db.map(`
            select
                cb.id,
                cb.tag_level_2,
                cb.category,
                cb.timetable,
                (SELECT MAX(upper(entrance))
                 FROM cb_events_entrance_times cbet
                 WHERE cbet.event_id  = cb.id) AS lastdate
            from cb_events cb
            WHERE cb.deleted_at IS NULL
            `, undefined, (row) => {
            return {
                id: +row.id,
                category: row.category as EventCategory,
                timetable: row.timetable,
                tagLevel2: row.tag_level_2,
                lastDate: row.lastdate
            }
        })
    }

    public async updateTagsLevel2(tags: TagUpdate[], dbTx: ITask<IExtensions>): Promise<void> {
        if (tags.length > 0) {
            const s = this.pgp.helpers.update(tags.map(t => ({ id: t.id, tag_level_2: t.tagLevel2 })), this.dbColUpdateTagLevel2) + ' WHERE v.id = t.id'
            await dbTx.none(s)
        }
    }

    public async syncEventIntervals(eventsWithIntervals: EventIntervalForSave[], dbTx: ITask<IExtensions>): Promise<void> {
        if (eventsWithIntervals.length > 0) {
            await dbTx.txIf({reusable: true}, async (dbTx: ITask<IExtensions>) => {
                await dbTx.none(`DELETE FROM cb_events_entrance_times WHERE event_id IN($1:csv)`, [eventsWithIntervals.map(e => e.eventId)])
                const intervals = EventsSyncRepository.convertToIntervals(eventsWithIntervals)
                if (intervals.length > 0) {
                    await dbTx.none(this.pgp.helpers.insert(intervals, this.dbColIntervals))
                }
            })
        }
    }

    private static mapToDb(event: EventToSave, updatedAt: Date): DbEvent {
        delete event.primaryData.publish

        return {
            ...event.primaryData,
            ext_id: event.primaryData.extId,
            tag_level_1: encodeTagsLevel1(event.primaryData.category, event.primaryData.tag_level_1),
            is_anytime: event.is_anytime,
            order_rnd: event.order_rnd !== undefined ? event.order_rnd : generateRandomOrder(),
            likes_fake: event.fakeLikes,
            dislikes_fake: event.fakeDislikes,
            updated_at: updatedAt,
            deleted_at: event.dateDeleted
        }
    }

    private static convertToIntervals(eventsIntervals: EventIntervalForSave[]): DbEventEntranceRow[] {
        return eventsIntervals.flatMap(e => {
            const m = e.timeIntervals.map(ti => {
                if (Array.isArray(ti)) {
                    return {
                        event_id: e.eventId,
                        entrance: `[${ti.map(i => i.toISOString()).join(',')})`
                    }
                } else {
                    return {
                        event_id: e.eventId,
                        entrance: `[${ti.toISOString()}, ${ti.toISOString()}]`,
                    }
                }
            })
            return m
        })
    }
}

