import { DbEvent, EventToSave } from '../interfaces/db-interfaces'
import { decodeTagsLevel1, encodeTagsLevel1 } from '../util/tag-level1-encoder'
import { ColumnSet, IDatabase, IMain, ITask } from 'pg-promise';
import { db } from './db'
import md5 from 'md5'
import { MomentIntervals } from '../lib/timetable/intervals'
import { logger } from '../util/logger'

function generateRandomOrder() {
    return Math.ceil(Math.random() * 1000000)
}


export interface DeletedEvent {
    id: number
    ext_id: string
    category: string
    title: string
}

export interface EventToUpdate extends EventToSave {
    id: number
}

export interface SyncDiff {
    insertedEvents: EventToSave[]
    updatedEvents: EventToUpdate[]
    notChangedEvents: EventToUpdate[]
    deletedEvents: DeletedEvent[]
}

export interface EventForRefresh {
    id: number
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

export function postgresConcat(event: DbEvent) {
    function mapToType(value: any): string {
        if (typeof value === 'string') {
            return JSON.stringify(value)
        } else if (typeof value === 'boolean') {
            return value ? 'true' : 'false'
        } else {
            return value
        }
    }

    const s = getMd5Columns().map(key => {
            const element = event[key]
            if (Array.isArray(element)) {
                return '[' + element.map(q => mapToType(q)).join(',') + ']'
            } else {
                return mapToType(element)
            }
        })
        .join(', ')
    return `[${s}]`;
}

function getMd5Columns(): (keyof DbEvent)[] {
    const md5Columns = eventColumnsDef
        .map(c => typeof c === 'string' ? c : c.name)
        .filter(n => n !== 'order_rnd')
    return md5Columns as (keyof DbEvent)[]
}

export function buildPostgresMd5Expression(prefix: string = undefined) {
    return `json_build_array(${(getMd5Columns().map(c => prefix ? prefix + '.' + c : c)).join(',')})`
}

export const eventColumnsDef = [
    'category',
    'title',
    'place',
    'address',
    'geotag',
    'timetable',
    'duration',
    'price',
    'notes',
    'description',
    'url',
    { name: 'tag_level_1', cast: 'text[]' },
    { name: 'tag_level_2', cast: 'text[]' },
    { name: 'tag_level_3', cast: 'text[]' },
    'rating',
    'reviewer',
    'is_anytime',
    'order_rnd',
    'ext_id'
]


export class EventsSyncRepository {
    readonly dbColIntervals: ColumnSet
    readonly dbColEvents: ColumnSet

    constructor(private db: IDatabase<any>, private pgp: IMain) {
        this.dbColIntervals = new pgp.helpers.ColumnSet(['event_id', 'entrance'], {table: 'cb_events_entrance_times'})
        this.dbColEvents = new pgp.helpers.ColumnSet(eventColumnsDef, {table: 'cb_events'});
    }

    public async syncDatabase(newEvents: EventToSave[]): Promise<SyncDiff> {
        return await this.db.tx('sync', async (dbTx: ITask<{}> & {}) => {
            const syncDiff = await this.prepareDiffForSync(newEvents, dbTx)
            await this.syncDiff(syncDiff, dbTx)
            return syncDiff
        })
    }

    public async prepareDiffForSync(newEvents: EventToSave[], db: ITask<{}>): Promise<SyncDiff> {
        const result: SyncDiff = {
            updatedEvents: [],
            insertedEvents: [],
            notChangedEvents: [],
            deletedEvents: []
        }

        await db.txIf(async (dbTx: ITask<{}> & {}) => {

            const existingIdsRaw = await dbTx.manyOrNone(`
                    SELECT id,
                           ext_id AS extid,
                           ${buildPostgresMd5Expression()}::TEXT AS md5text,
                           MD5(${buildPostgresMd5Expression()}::TEXT) AS md5
                    FROM cb_events`)

            const extIdToChecksum = new Map()
            const extIdToId = new Map()
            const removedEventExtIds = new Set();


            existingIdsRaw.forEach(({id, extid, md5}) => {
                extIdToChecksum.set(extid, md5)
                extIdToId.set(extid, id)
                removedEventExtIds.add(extid)
            })


            newEvents.forEach((newEvent) => {

                const newRow = EventsSyncRepository.mapToDb(newEvent)
                const existingMd5 = extIdToChecksum.get(newEvent.primaryData.ext_id)
                if (existingMd5 === undefined) {
                    result.insertedEvents.push(newEvent)
                } else if (existingMd5 != md5(postgresConcat(newRow))) {
                    result.updatedEvents.push({
                        ...newEvent,
                        id: +extIdToId.get(newEvent.primaryData.ext_id)
                    })

                    const old = existingIdsRaw.find(e => e['extid'] === newEvent.primaryData.ext_id)['md5text']
                    const new2 = postgresConcat(newRow)
                    logger.silly('problem md5?')
                    logger.silly(old)
                    logger.silly(new2)

                } else {
                    result.notChangedEvents.push({
                        ...newEvent,
                        id: existingIdsRaw.find(e => e['extid'] === newEvent.primaryData.ext_id).id
                    })
                }
                removedEventExtIds.delete(newEvent.primaryData.ext_id)
            })

            if (removedEventExtIds.size > 0) {
                result.deletedEvents = await dbTx.many(`SELECT id, category, title, ext_id FROM cb_events WHERE ext_id IN ($1:csv)`, [Array.from(removedEventExtIds)])
            }
        })
        return result
    }

    public async syncDiff(syncDiff: SyncDiff, db: ITask<{}>): Promise<void> {
        const newDbRows = syncDiff.insertedEvents.map(EventsSyncRepository.mapToDb)
        const updateDbRows: (DbEvent & { id: number })[] = syncDiff.updatedEvents.map(e => {
            return {...EventsSyncRepository.mapToDb(e), id: e.id}
        })
        const eventsIntervalToSync: EventIntervalForSave[] = syncDiff.updatedEvents
            .map(({ id, timeIntervals }) => { return { eventId: id, timeIntervals } })

        await db.txIf({ reusable: true }, async (dbTx: ITask<{}> & {}) => {

            if (syncDiff.deletedEvents.length > 0) {
                await dbTx.none(`DELETE FROM cb_events WHERE id IN ($1:csv)`, [syncDiff.deletedEvents.map(e => e.id)])
            }

            if (newDbRows.length > 0) {
                const newEventsId = await this.insertNewEvents(dbTx, newDbRows)
                syncDiff.insertedEvents.forEach((createdEvent, index) => {
                    createdEvent.primaryData.id = newEventsId[index]
                    eventsIntervalToSync.push({
                        eventId: newEventsId[index],
                        timeIntervals: createdEvent.timeIntervals
                    })
                })
            }


            if (syncDiff.updatedEvents.length > 0) {
                const s = this.pgp.helpers.update(updateDbRows, this.dbColEvents.merge(['?id'])) + ' WHERE v.id = t.id'
                await dbTx.none(s)
            }

            await this.syncEventIntervals(eventsIntervalToSync, dbTx)
        })
    }

    public async shuffle(): Promise<void> {
        await db.none('update cb_events set order_rnd = CEIL(random() * 1000000)')
    }

    public async getLastEventDates(): Promise<EventForRefresh[]> {
        return await db.map(`
            select
                ce.id,
                ce.timetable,
                (SELECT MAX(upper(entrance))
                 FROM cb_events_entrance_times cbet
                 WHERE cbet.event_id  = ce.id) AS lastdate
            from cb_events ce`, undefined, ({id, timetable, lastdate}) => {
            return {
                id: +id,
                timetable,
                lastDate: lastdate
            }
        })
    }

    public async syncEventIntervals(eventsWithIntervals: EventIntervalForSave[], dbTx: ITask<{}>) {
        if (eventsWithIntervals.length > 0) {
            await dbTx.txIf({ reusable: true }, async (dbTx: ITask<{}> & {}) => {
                await dbTx.none(`DELETE FROM cb_events_entrance_times WHERE event_id IN($1:csv)`, [eventsWithIntervals.map(e => e.eventId)])
                const intervals = EventsSyncRepository.convertToIntervals(eventsWithIntervals)
                if (intervals.length > 0) {
                    await dbTx.none(this.pgp.helpers.insert(intervals, this.dbColIntervals))
                }
            })
        }
    }

    private async insertNewEvents(dbTx: ITask<{}>, newDbRows: DbEvent[]) {
        const s = this.pgp.helpers.insert(newDbRows, this.dbColEvents) + ' RETURNING id'
        return await dbTx.map(s, [], r => +r.id)
    }

    private static mapToDb(event: EventToSave): DbEvent {
        delete event.primaryData.publish

        return {
            ...event.primaryData,
            tag_level_1: encodeTagsLevel1(event.primaryData.category, event.primaryData.tag_level_1),
            is_anytime: event.is_anytime,
            order_rnd: event.order_rnd !== undefined ? event.order_rnd : generateRandomOrder()
        };
    }

    private static mapFromDb(dbEvent: DbEvent) {
        const d = { ... dbEvent }
        d.tag_level_1 = decodeTagsLevel1(dbEvent.tag_level_1)
        return d
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
            return m;
        })
    }
}

