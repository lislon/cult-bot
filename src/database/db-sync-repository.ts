import { DbEvent, EventToSave } from '../interfaces/db-interfaces'
import { encodeTagsLevel1 } from '../util/tag-level1-encoder'
import { ColumnSet, IDatabase, IMain, ITask } from 'pg-promise';
import { db } from './db'
import md5 from 'md5'
import { MomentIntervals } from '../lib/timetable/intervals'
import { logger } from '../util/logger'

function generateRandomOrder() {
    return Math.ceil(Math.random() * 1000000)
}

export type PostgresType = 'text' | 'int' | '_text' | 'bool'
export interface DeletedEvent {
    id: number
    ext_id: string
    category: string
    title: string
}

export interface SyncResults {
    insertedEvents: EventToSave[]
    updatedEvents: EventToSave[]
    notChangedEvents: EventToSave[]
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
    id: number
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
    'subcategory',
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

    public async syncDatabase(newEvents: EventToSave[]): Promise<SyncResults> {
        const result: SyncResults = {
            updatedEvents: [],
            insertedEvents: [],
            notChangedEvents: [],
            deletedEvents: []
        }

        if (newEvents.length > 0) {

            await this.db.tx(async (dbTx: ITask<{}> & {}) => {
                const existingIdsRaw = await db.manyOrNone(`
                    SELECT id,
                           ext_id AS extid,
                           ${buildPostgresMd5Expression()}::TEXT AS md5text,
                           MD5(${buildPostgresMd5Expression()}::TEXT) AS md5
                    FROM cb_events`)

                const extIdToChecksum = new Map()
                const extIdToId = new Map()
                const removedEventExtIds = new Set();
                const eventsIntervalToSync: EventIntervalForSave[] = []

                existingIdsRaw.forEach(({ id, extid, md5 }) => {
                    extIdToChecksum.set(extid, md5)
                    extIdToId.set(extid, id)
                    removedEventExtIds.add(extid)
                })

                const newDbRows: DbEvent[] = []
                const updateDbRows: (DbEvent & { id: number })[] = []

                newEvents.forEach((newEvent) => {

                    const newRow = EventsSyncRepository.mapToDb(newEvent)
                    const newRowMd5 = md5(postgresConcat(newRow))
                    const existingMd5 = extIdToChecksum.get(newEvent.primaryData.ext_id)
                    if (existingMd5 === undefined) {
                        result.insertedEvents.push(newEvent)
                        newDbRows.push(newRow)
                    } else if (existingMd5 != newRowMd5) {
                        result.updatedEvents.push(newEvent)
                        const id = +extIdToId.get(newEvent.primaryData.ext_id)
                        updateDbRows.push({ ...newRow, id: id })
                        eventsIntervalToSync.push({ id: id, timeIntervals: newEvent.timeIntervals })

                        const old = existingIdsRaw.find(e => e['extid'] === newEvent.primaryData.ext_id)['md5text']
                        const new2 = postgresConcat(newRow)
                        logger.silly('problem md5?')
                        logger.silly(old)
                        logger.silly(new2)

                    } else {
                        result.notChangedEvents.push(newEvent)
                    }
                    removedEventExtIds.delete(newEvent.primaryData.ext_id)
                })


                if (removedEventExtIds.size > 0) {
                    result.deletedEvents = await dbTx.many(`SELECT id, category, title, ext_id FROM cb_events WHERE ext_id IN ($1:csv)`, [Array.from(removedEventExtIds)])
                    await dbTx.none(`DELETE FROM cb_events WHERE ext_id IN ($1:csv)`, [Array.from(removedEventExtIds)])
                }

                if (newDbRows.length > 0) {
                    const newEventsId = await this.insertNewEvents(dbTx, newDbRows)
                    result.insertedEvents.forEach((createdEvent, index) => {
                        eventsIntervalToSync.push({
                            id: newEventsId[index],
                            timeIntervals: createdEvent.timeIntervals
                        })
                    })
                }

                if (result.updatedEvents.length > 0) {
                    const s = this.pgp.helpers.update(updateDbRows, this.dbColEvents.merge(['?id'])) + ' WHERE v.id = t.id'
                    await dbTx.none(s)
                }

                await this.syncEventIntervals(dbTx, eventsIntervalToSync)
            })
        }
        return result
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

    public async syncEventIntervals(dbTx: ITask<{}>, eventsIntervals: EventIntervalForSave[]) {
        if (eventsIntervals.length > 0) {
            await dbTx.none(`DELETE FROM cb_events_entrance_times WHERE event_id IN($1:csv)`, eventsIntervals.map(e => e.id))
            const intervals = EventsSyncRepository.convertToIntervals(eventsIntervals)
            if (intervals.length > 0) {
                await dbTx.none(this.pgp.helpers.insert(intervals, this.dbColIntervals))
            }
        }
    }

    private async insertNewEvents(dbTx: ITask<{}>, newDbRows: DbEvent[]) {
        const s = this.pgp.helpers.insert(newDbRows, this.dbColEvents) + ' RETURNING id'
        return await dbTx.map(s, [], r => +r.id)
    }
    private static mapToDb(event: EventToSave): DbEvent {
        delete event.primaryData.publish

        event.primaryData.tag_level_1 = encodeTagsLevel1(event.primaryData.category, event.primaryData.tag_level_1);

        return {
            ...event.primaryData,
            is_anytime: event.is_anytime,
            order_rnd: event.order_rnd !== undefined ? event.order_rnd : generateRandomOrder()
        };
    }

    private static convertToIntervals(eventsIntervals: EventIntervalForSave[]): DbEventEntranceRow[] {
        return eventsIntervals.flatMap(e => {
            const m = e.timeIntervals.map(ti => {
                if (Array.isArray(ti)) {
                    return {
                        event_id: e.id,
                        entrance: `[${ti.map(i => i.toISOString()).join(',')})`
                    }
                } else {
                    return {
                        event_id: e.id,
                        entrance: `[${ti.toISOString()}, ${ti.toISOString()}]`,
                    }
                }
            })
            return m;
        })
    }
}

