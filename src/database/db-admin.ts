import { Event, EventCategory, MyInterval } from '../interfaces/app-interfaces'
import { db } from './db'
import { mapToPgInterval } from './db-utils'
import { IDatabase, IMain } from 'pg-promise'
import { buildPostgresMd5Expression } from './db-sync-repository'
import { SELECT_ALL_EVENTS_FIELDS } from './db-events-common'

export class StatByCat {
    category: string
    count: string
}

export class StatByReviewer {
    reviewer: string
    count: string
}

export interface EventWithOldVersion extends Event {
    snapshotStatus: 'updated' | 'inserted' | 'unchanged'
}

const SELECT_ADMIN_EVENT_FIELDS = `${SELECT_ALL_EVENTS_FIELDS}, views`

export class AdminRepository {

    private snapshotSelectQueryPart = `
        CASE
            WHEN cbs.id IS NULL THEN 'inserted'
            WHEN (${buildPostgresMd5Expression('cbs')}::TEXT <> ${buildPostgresMd5Expression('cb')}::TEXT) THEN 'updated'
            ELSE 'unchanged'
        END AS snapshot_status`

    private snapshotWhereQueryPart = `(cbs.id IS NULL OR (${buildPostgresMd5Expression('cbs')}::TEXT <> ${buildPostgresMd5Expression('cb')}::TEXT))`

    private snapshotOrderByQueryPart = `
        (CASE
            WHEN w.snapshot_status = 'inserted' THEN 0
            WHEN w.snapshot_status = 'updated' THEN 1
            ELSE 2
        END)`

    constructor(private db: IDatabase<any>, private pgp: IMain) {
    }

    async findChangedEventsByCatStats(interval: MyInterval): Promise<StatByCat[]> {
        const finalQuery = `
        SELECT cb.category, COUNT(cb.id)
        FROM cb_events cb
        LEFT JOIN cb_events_snapshot cbs ON (cbs.ext_id = cb.ext_id)
        WHERE
            ${this.snapshotWhereQueryPart}
            AND cb.deleted_at IS NULL
            AND
            EXISTS(
                select id
                FROM cb_events_entrance_times cbet
                where $(interval) && cbet.entrance AND cbet.event_id = cb.id
                 )
        GROUP BY cb.category
        ORDER BY cb.category
    `
        return await db.any(finalQuery,
            {
                interval: mapToPgInterval(interval),
            }) as StatByCat[];
    }

    async findStatsByReviewer(interval: MyInterval): Promise<StatByReviewer[]> {
        const finalQuery = `
        SELECT cb.reviewer, COUNT(cb.id)
        FROM cb_events cb
        WHERE
            cb.deleted_at IS NULL
            AND
            EXISTS(
                select id
                FROM cb_events_entrance_times cbet
                where $(interval) && cbet.entrance AND cbet.event_id = cb.id
                 )
        GROUP BY cb.reviewer
        ORDER BY cb.reviewer
    `
        return await db.any(finalQuery,
            {
                interval: mapToPgInterval(interval),
            }) as StatByReviewer[];
    }

    async findAllChangedEventsByCat(category: EventCategory, interval: MyInterval, limit: number = 50, offset: number = 0): Promise<EventWithOldVersion[]> {
        const finalQuery = `
        select * FROM (
            SELECT ${SELECT_ADMIN_EVENT_FIELDS}, ${this.snapshotSelectQueryPart}
            FROM cb_events cb
            LEFT JOIN cb_events_snapshot cbs ON (cbs.ext_id = cb.ext_id)
            WHERE
                ${this.snapshotWhereQueryPart}
                AND cb.deleted_at IS NULL
                AND EXISTS(
                    select id
                    FROM cb_events_entrance_times cbet
                    where $(interval) && cbet.entrance AND cbet.event_id = cb.id
                     )
                AND cb.category = $(category)
        ) w
        ORDER BY ${this.snapshotOrderByQueryPart}, w.title
        LIMIT $(limit) OFFSET $(offset)
    `
        return await db.map(finalQuery,
            {
                interval: mapToPgInterval(interval),
                category,
                limit,
                offset
            }, AdminRepository.mapToEventWithId) as EventWithOldVersion[];
    }

    async findAllEventsByReviewer(reviewer: string, interval: MyInterval, limit: number = 50, offset: number = 0): Promise<EventWithOldVersion[]> {
        const finalQuery = `
        select * FROM (
            SELECT ${SELECT_ADMIN_EVENT_FIELDS}, ${this.snapshotSelectQueryPart}
            FROM cb_events cb
            LEFT JOIN cb_events_snapshot cbs ON (cbs.ext_id = cb.ext_id)
            WHERE
                cb.deleted_at IS NULL
                AND EXISTS(
                    select id
                    FROM cb_events_entrance_times cbet
                    where $(interval) && cbet.entrance AND cbet.event_id = cb.id
                     )
                AND cb.reviewer = $(reviewer)
        ) w
        ORDER BY ${this.snapshotOrderByQueryPart}, w.is_anytime ASC, w.title ASC
        LIMIT $(limit) OFFSET $(offset)
    `

        return await db.map(finalQuery,
            {
                interval: mapToPgInterval(interval),
                reviewer,
                limit,
                offset
            }, AdminRepository.mapToEventWithId) as EventWithOldVersion[]
    }

    async findSnapshotEvent(extId: string, version: 'current' | 'snapshot'): Promise<EventWithOldVersion> {
        const table = version == 'current' ? 'cb_events' : 'cb_events_snapshot'
        return await db.one(`
            SELECT *, 'updated' AS snapshot_status
            FROM ${table}
            WHERE ext_id = $1 AND deleted_at IS NULL`, extId, AdminRepository.mapToEventWithId)
    }

    async countTotalRows(): Promise<number> {
        return await db.one(`
        select  (select COUNT(id) from cb_events) +
                (select COUNT(id) from cb_events_entrance_times) +
                (select COUNT(id) from cb_feedbacks) +
                (select COUNT(id) from cb_survey) +
                (select COUNT(id) from cb_users) +
                (select COUNT(id) from migrations m2 ) AS count`, undefined, (c => +c.count))
    }

    private static mapToEventWithId(row: any ): EventWithOldVersion {
        const newRow = { ...row, id: +row.id, snapshotStatus: row.snapshot_status }
        delete row.snapshot_status
        return newRow
    }

}

