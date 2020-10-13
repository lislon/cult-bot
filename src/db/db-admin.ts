import { Event, EventCategory, MyInterval } from '../interfaces/app-interfaces'
import { db } from '../db'
import { mapToPgInterval } from './db-utils'
import { IDatabase, IMain } from 'pg-promise'

export class Stat {
    category: string
    count: string
}

export class AdminRepository {
    constructor(private db: IDatabase<any>, private pgp: IMain) {
    }

    async findStats(interval: MyInterval): Promise<Stat[]> {
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
            }) as Stat[];
    }

    async findAllEventsAdmin(category: EventCategory, interval: MyInterval, limit: number = 50, offset: number = 0): Promise<Event[]> {
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
}

