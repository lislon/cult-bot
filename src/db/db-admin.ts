import { Event, EventCategory } from '../interfaces/app-interfaces'
import { Moment } from 'moment'
import { db } from '../db'
import { mapToPgInterval } from './db-utils'

export class Stat {
    category: string
    count: string
}

export async function findStats(interval: Moment[]): Promise<Stat[]> {
    const adjustedIntervals = [interval[0].clone(), interval[1].clone()]

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
            interval: mapToPgInterval(adjustedIntervals),
        }) as Stat[];
}

export async function findAllEventsAdmin(category: EventCategory, interval: Moment[], limit: number = 50): Promise<Event[]> {
    const adjustedIntervals = [interval[0].clone(), interval[1].clone()]

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
        LIMIT $(limit)
    `
    return await db.any(finalQuery,
        {
            interval: mapToPgInterval(adjustedIntervals),
            category,
            limit
        }) as Event[];
}