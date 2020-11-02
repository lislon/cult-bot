import { Event, EventCategory, MyInterval } from '../interfaces/app-interfaces'
import { db } from '../db'
import { mapToPgInterval } from './db-utils'
import { IDatabase, IMain } from 'pg-promise'

export class StatByCat {
    category: string
    count: string
}

export class StatByReviewer {
    reviewer: string
    count: string
}

export class AdminRepository {
    constructor(private db: IDatabase<any>, private pgp: IMain) {
    }

    async findStatsByCat(interval: MyInterval): Promise<StatByCat[]> {
        const finalQuery = `
        SELECT cb.category, COUNT(cb.id)
        FROM cb_events cb
        WHERE
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

    async findAllEventsByCat(category: EventCategory, interval: MyInterval, limit: number = 50, offset: number = 0): Promise<Event[]> {
        const finalQuery = `
        SELECT cb.*
        FROM cb_events cb
        WHERE
            EXISTS(
                select id
                FROM cb_events_entrance_times cbet
                where $(interval) && cbet.entrance AND cbet.event_id = cb.id
                 )
            AND cb.category = $(category)
        ORDER BY cb.title
        LIMIT $(limit) OFFSET $(offset)
    `
        return await db.any(finalQuery,
            {
                interval: mapToPgInterval(interval),
                category,
                limit,
                offset
            }) as Event[];
    }

    async findAllEventsByReviewer(reviewer: string, interval: MyInterval, limit: number = 50, offset: number = 0): Promise<Event[]> {
        const finalQuery = `
        SELECT cb.*
        FROM cb_events cb
        WHERE
            EXISTS(
                select id
                FROM cb_events_entrance_times cbet
                where $(interval) && cbet.entrance AND cbet.event_id = cb.id
                 )
            AND cb.reviewer = $(reviewer)
        ORDER BY cb.is_anytime ASC, cb.title ASC
        LIMIT $(limit) OFFSET $(offset)
    `
        return await db.any(finalQuery,
            {
                interval: mapToPgInterval(interval),
                reviewer,
                limit,
                offset
            }) as Event[];
    }
}

