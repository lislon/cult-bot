import { Moment } from 'moment'
import { db } from '../db'
import { Event, EventCategory } from '../interfaces/app-interfaces'
import { TagCategory } from '../interfaces/db-interfaces'
import { mapToPgInterval } from './db-utils'


export async function findTopEventsInRange(category: EventCategory, interval: Moment[], limit: number = 3): Promise<Event[]> {
    const adjustedIntervals = [interval[0].clone(), interval[1].clone()]
    if (category === 'exhibitions') {
        adjustedIntervals[0].add(90, 'minutes')
    }

    const primaryEvents = `
        SELECT cb.*
        FROM cb_events cb
        WHERE
            EXISTS
            (
                select id
                FROM cb_events_entrance_times cbet
                where $(interval) && cbet.entrance AND cbet.event_id = cb.id
            )
            AND cb.category = $(category)
            AND cb.is_anytime = false
        ORDER BY cb.rating DESC, random()
        LIMIT $(limit)
    `

    const secondaryEvents = `
        select
            top30.*
        from
            (select cb.*
            from cb_events cb
            where
                EXISTS
                (
                    select id
                    FROM cb_events_entrance_times cbet
                    where $(interval) && cbet.entrance AND cbet.event_id = cb.id
                )
                and cb.category =  $(category)
                and cb.is_anytime = true
            order by
                cb.rating desc
            limit 30 ) as top30
        order by
            random()
        limit $(limit)
    `

    const finalQuery = `(${primaryEvents}) UNION ALL (${secondaryEvents}) LIMIT $(limit)`

    return await db.any(finalQuery,
        {
            interval: mapToPgInterval(adjustedIntervals),
            category,
            limit
        }) as Event[];
}

async function loadTags(cat: TagCategory) {
    return await db.map('' +
        ' SELECT t.name ' +
        ' FROM cb_tags t' +
        ' WHERE t.category = $1' +
        ' ORDER BY t.name', [cat], (row) => row.name) as string[];
}

export async function loadAllPriorities(): Promise<string[]> {
    return await loadTags('tag_level_2')
}

export async function loadAllOblasti(): Promise<string[]> {
    return await loadTags('tag_level_1')
}