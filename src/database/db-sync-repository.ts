import { DbEvent, EventToSave } from '../interfaces/db-interfaces'
import { encodeTagsLevel1 } from '../util/tag-level1-encoder'
import { ColumnSet, IDatabase, IMain, ITask } from 'pg-promise'
import { db } from './db'
import md5 from 'md5'
import { MomentIntervals } from '../lib/timetable/intervals'
import { logger } from '../util/logger'
import { keyBy } from 'lodash'

function generateRandomOrder() {
    return Math.ceil(Math.random() * 1000000)
}


export interface DeletedEvent {
    id: number
    ext_id: string
    category: string
    title: string
}

export interface EventToRecover extends EventToSave {
    old: {
        title: string
    }
}

export interface SyncDiff {
    insertedEvents: EventToSave[]
    updatedEvents: EventToSave[]
    notChangedEvents: EventToSave[]
    deletedEvents: DeletedEvent[]
    recoveredEvents: EventToRecover[]
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

const MD5_IGNORE: (keyof DbEvent)[] = ['order_rnd', 'updated_at', 'deleted_at']

function getMd5Columns(): (keyof DbEvent)[] {
    const md5Columns = eventColumnsDef
        .map(c => (typeof c === 'string' ? c : c.name) as keyof DbEvent)
        .filter(n => !MD5_IGNORE.includes(n))
    return md5Columns as (keyof DbEvent)[]
}

export function buildPostgresMd5Expression(prefix: string = undefined) {
    return `json_build_array(${(getMd5Columns().map(c => prefix ? prefix + '.' + c : c)).join(',')})`
}


// generic way to skip NULL/undefined values for strings:
function str(column: string) {
    return {
        name: column,
        skip: (c: { value: any }) => c.value === null || c.value === undefined
    };
}

// generic way to skip NULL/undefined values for integers,
// while parsing the type correctly:
function int(column: string) {
    return {
        name: column,
        skip: (c: { value: any }) => c.value === null || c.value === undefined,
        init: (c: { value: any }) => +c.value
    };
}

function textArray(column: string) {
    return {
        name: column,
        cast: 'text[]',
        skip: (c: { value: any }) => c.value === null || c.value === undefined
    };
}

function timestamptzNullable(column: string) {
    return {
        name: column,
        cast: 'timestamptz',
        skip: (c: { value: any }) => c.value === undefined
    };
}

export const eventColumnsDef = [
    str('category'),
    str('title'),
    str('place'),
    str('address'),
    str('geotag'),
    str('timetable'),
    str('duration'),
    str('price'),
    str('notes'),
    str('description'),
    str('url'),
    textArray('tag_level_1'),
    textArray('tag_level_2'),
    textArray('tag_level_3'),
    int('rating'),
    str('reviewer'),
    str('is_anytime'),
    int('order_rnd'),
    str('ext_id'),
    timestamptzNullable('updated_at'),
    timestamptzNullable('deleted_at')
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
            deletedEvents: [],
            recoveredEvents: []
        }
        const now = new Date()

        await db.txIf(async (dbTx: ITask<{}> & {}) => {

            const existingIdsRaw = await dbTx.manyOrNone(`
                    SELECT id,
                           ext_id AS extid,
                           ${buildPostgresMd5Expression()}::TEXT AS md5text,
                           MD5(${buildPostgresMd5Expression()}::TEXT) AS md5
                    FROM cb_events
                    WHERE deleted_at IS NULL
                    `)

            const extIdToChecksum = new Map()
            const extIdToId = new Map()
            const removedEventExtIds = new Set();


            existingIdsRaw.forEach(({id, extid, md5}) => {
                extIdToChecksum.set(extid, md5)
                extIdToId.set(extid, id)
                removedEventExtIds.add(extid)
            })

            const maybeInsertedEvents: EventToSave[] = []

            newEvents.forEach((newEvent) => {

                const newRow = EventsSyncRepository.mapToDb(newEvent, now)
                const existingMd5 = extIdToChecksum.get(newEvent.primaryData.ext_id)
                if (existingMd5 === undefined) {
                    maybeInsertedEvents.push(newEvent)
                } else if (existingMd5 != md5(postgresConcat(newRow))) {
                    const e = { ...newEvent }
                    e.primaryData.id = +extIdToId.get(newEvent.primaryData.ext_id)
                    result.updatedEvents.push(e)

                    const old = existingIdsRaw.find(e => e['extid'] === newEvent.primaryData.ext_id)['md5text']
                    const new2 = postgresConcat(newRow)
                    logger.silly('problem md5?')
                    logger.silly(old)
                    logger.silly(new2)

                } else {
                    const e = { ...newEvent }
                    e.primaryData.id =  existingIdsRaw.find(e => e['extid'] === newEvent.primaryData.ext_id).id
                    result.notChangedEvents.push(e)
                }
                removedEventExtIds.delete(newEvent.primaryData.ext_id)
            })

            if (removedEventExtIds.size > 0) {
                result.deletedEvents = await dbTx.many(`
                SELECT id, category, title, ext_id
                FROM cb_events
                WHERE ext_id IN ($1:csv) AND deleted_at IS NULL`, [Array.from(removedEventExtIds)])
            }

            if (maybeInsertedEvents.length > 0) {
                const recoveredEvents = await dbTx.map(`
                        SELECT id,
                               ext_id AS extid,
                               title
                        FROM cb_events
                        WHERE deleted_at IS NOT NULL AND ext_id IN ($(extIds:csv))
                        `, {
                    extIds: maybeInsertedEvents.map(e => e.primaryData.ext_id)
                }, (({id, extid, title}) => {
                    return {id: +id, extid, title}
                }))

                const deletedByExtId = keyBy<{ id: number, title: string }>(recoveredEvents, 'extid')

                maybeInsertedEvents.forEach(e => {
                    const recoveredEvent = deletedByExtId[e.primaryData.ext_id]
                    if (recoveredEvent !== undefined) {
                        const recoveredItem = {
                            ...e,
                            old: {
                                title: recoveredEvent.title
                            }
                        }
                        recoveredItem.primaryData.id = recoveredEvent.id
                        result.recoveredEvents.push(recoveredItem)
                    } else {
                        result.insertedEvents.push(e)
                    }
                })
            }
        })
        return result
    }

    public async syncDiff(syncDiff: SyncDiff, db: ITask<{}>): Promise<void> {
        const now = new Date()

        const newDbRows = syncDiff.insertedEvents.map(e => EventsSyncRepository.mapToDb(e, now))

        const updatedAndRecovered = [... syncDiff.updatedEvents, ...syncDiff.recoveredEvents]
        const updatedAndRecoveredRows: (DbEvent & { id: number })[] = updatedAndRecovered.map(e => {
            return {...(EventsSyncRepository.mapToDb(e, now)), id: e.primaryData.id}
        })

        const eventsIntervalToSync: EventIntervalForSave[] = updatedAndRecovered
            .map(({ primaryData, timeIntervals }) => { return { eventId: primaryData.id, timeIntervals } })

        await db.txIf({ reusable: true }, async (dbTx: ITask<{}> & {}) => {

            await this.deleteEvents(dbTx, syncDiff.deletedEvents, now)

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


            if (updatedAndRecoveredRows.length > 0) {
                const s = this.pgp.helpers.update(updatedAndRecoveredRows, this.dbColEvents.merge(['?id'])) + ' WHERE v.id = t.id'
                await dbTx.none(s)
            }

            await this.syncEventIntervals(eventsIntervalToSync, dbTx)
        })
    }

    public async shuffle(): Promise<void> {
        await db.none(`
            UPDATE cb_events
            SET order_rnd = CEIL(random() * 1000000)
            WHERE deleted_at IS NULL
        `)
    }

    public async getLastEventDates(): Promise<EventForRefresh[]> {
        return await db.map(`
            select
                cb.id,
                cb.timetable,
                (SELECT MAX(upper(entrance))
                 FROM cb_events_entrance_times cbet
                 WHERE cbet.event_id  = cb.id) AS lastdate
            from cb_events cb
            WHERE cb.deleted_at IS NULL
            `, undefined, ({id, timetable, lastdate}) => {
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
    private async deleteEvents(dbTx: ITask<{}>, deletedEvents: DeletedEvent[], dateDeleted: Date) {
        if (deletedEvents.length > 0) {
            const s = this.pgp.helpers.update({
                deleted_at: dateDeleted,
            }, this.dbColEvents) + ' WHERE id IN ($1:csv)'
            const eventIds = deletedEvents.map(e => e.id)
            await dbTx.none(s, [eventIds])
            await dbTx.none(`DELETE FROM cb_events_entrance_times WHERE event_id IN($1:csv)`, [eventIds])
        }
    }

    private async insertNewEvents(dbTx: ITask<{}>, newDbRows: DbEvent[]) {
        const s = this.pgp.helpers.insert(newDbRows, this.dbColEvents) + ' RETURNING id'
        return await dbTx.map(s, [], r => +r.id)
    }

    private static mapToDb(event: EventToSave, updatedAt: Date): DbEvent {
        delete event.primaryData.publish

        return {
            ...event.primaryData,
            tag_level_1: encodeTagsLevel1(event.primaryData.category, event.primaryData.tag_level_1),
            is_anytime: event.is_anytime,
            order_rnd: event.order_rnd !== undefined ? event.order_rnd : generateRandomOrder(),
            updated_at: updatedAt,
            deleted_at: event.dateDeleted
        };
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

