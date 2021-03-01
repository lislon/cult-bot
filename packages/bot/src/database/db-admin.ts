import { Event, EventCategory, MyInterval } from '../interfaces/app-interfaces'
import { db } from './db'
import { mapToPgInterval } from './db-utils'
import { IDatabase, IMain } from 'pg-promise'
import { buildPostgresMd5EventsExpression } from './db-sync-repository'
import { SELECT_ALL_EVENTS_FIELDS } from './db-events-common'

export class StatByCat {
    category: string
    count: string
}

export class StatByReviewer {
    reviewer: string
    count: string
}

export interface AdminEvent extends Event {
    snapshotStatus: 'updated' | 'inserted' | 'unchanged'
    popularity: number
    fakeLikes: number
    fakeDislikes: number
}

const SELECT_ADMIN_EVENTS_FIELDS = [SELECT_ALL_EVENTS_FIELDS, 'cb.popularity', 'cb.likes_fake', 'cb.dislikes_fake'].join(',')

export class AdminRepository {

    private snapshotSelectQueryPart = `
        CASE
            WHEN cbs.id IS NULL THEN 'inserted'
            WHEN (${buildPostgresMd5EventsExpression('cbs')}::TEXT <> ${buildPostgresMd5EventsExpression('cb')}::TEXT) THEN 'updated'
            ELSE 'unchanged'
        END AS snapshot_status`

    private snapshotWhereQueryPart = `(cbs.id IS NULL OR (${buildPostgresMd5EventsExpression('cbs')}::TEXT <> ${buildPostgresMd5EventsExpression('cb')}::TEXT))`

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

    async findAllChangedEventsByCat(category: EventCategory, interval: MyInterval, limit = 50, offset = 0): Promise<AdminEvent[]> {
        const finalQuery = `
        select * FROM (
            SELECT ${SELECT_ADMIN_EVENTS_FIELDS}, ${this.snapshotSelectQueryPart}
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
            }, AdminRepository.mapToEventWithId) as AdminEvent[]
    }

    async findAllEventsByReviewer(reviewer: string, interval: MyInterval, limit = 50, offset = 0): Promise<AdminEvent[]> {
        const finalQuery = `
        select * FROM (
            SELECT ${SELECT_ADMIN_EVENTS_FIELDS}, ${this.snapshotSelectQueryPart}
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
            }, AdminRepository.mapToEventWithId) as AdminEvent[]
    }

    public async getAdminEventsByIds(eventIds: number[]): Promise<AdminEvent[]> {
        if (eventIds.length === 0) {
            return []
        }
        return await this.db.map(`
            select ${SELECT_ADMIN_EVENTS_FIELDS}, ${this.snapshotSelectQueryPart}
            from cb_events cb
            LEFT JOIN cb_events_snapshot cbs ON (cbs.ext_id = cb.ext_id)
            JOIN unnest('{$(eventIds:list)}'::int[]) WITH ORDINALITY t(s_id, ord) ON (cb.id = s_id)
            ORDER BY ord
        `, {eventIds}, AdminRepository.mapToEventWithId)
    }

    async findSnapshotEvent(extId: string, version: 'current' | 'snapshot'): Promise<AdminEvent> {
        let q = ''
        if (version === 'current') {
            q = `
            SELECT *, 'updated' AS snapshot_status
            FROM cb_events
            WHERE ext_id = $1 AND deleted_at IS NULL`
        } else {
            q = `
            SELECT *, 'updated' AS snapshot_status
            FROM cb_events_snapshot
            WHERE ext_id = $1`
        }

        return await db.one(q, extId, AdminRepository.mapToEventWithId)
    }

    async countTotalRows(): Promise<number> {
        return await db.one(`
        select  (select COUNT(id) from cb_events) +
                (select COUNT(id) from cb_events_entrance_times) +
                (select COUNT(id) from cb_events_snapshot) +
                (select COUNT(*) from cb_events_snapshot_meta) +
                (select COUNT(id) from cb_feedbacks) +
                (select COUNT(id) from cb_survey) +
                (select COUNT(id) from cb_users) +
                (select COUNT(id) from migrations m2 ) AS count`, undefined, (c => +c.count))
    }

    private static mapToEventWithId(row: any): AdminEvent {
        const newRow: AdminEvent = {
            ...row,
            id: +row.id,
            extId: row.ext_id,
            snapshotStatus: row.snapshot_status,
            fakeLikes: +row.likes_fake,
            fakeDislikes: +row.dislikes_fake,
            popularity: +row.popularity
        }
        delete row.snapshot_status
        return newRow
    }

}

