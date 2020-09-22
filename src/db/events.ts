import { Moment } from 'moment'
import { db } from '../db'
import { Event, EventCategory } from '../interfaces/app-interfaces'
import { TagCategory } from '../interfaces/db-interfaces'

export async function findEventsDuringRange(interval: Moment[]) {
    return await db.any('' +
        ' SELECT * ' +
        ' FROM cb_time_intervals AS cbi' +
        ' WHERE ' +
        '      (cbi.time_from >= $1 AND cbi.time_from < $2 AND cbi.time_to IS NULL) ' +
        '   OR (cbi.time_from <= $1 AND cbi.time_to > $1)' +
        '   OR (cbi.time_from >= $1 AND cbi.time_to < $2) ' +
        '   OR (cbi.time_from <= $2 AND cbi.time_to > $2)' +
        '',

        [interval[0].toDate(), interval[1].toDate()])
}

export async function findTopEventsInRange(category: EventCategory, interval: Moment[], limit: number = 3): Promise<Event[]> {
    const adjustedIntervals = [interval[0].clone(), interval[1].clone()]
    if (category === 'exhibitions') {
        adjustedIntervals[0].add(90, 'minutes')
    }

    const primaryEvents = '' +
        ' SELECT cb.* ' +
        ' FROM cb_events cb ' +
        ' WHERE cb.id IN (' +
        '    SELECT DISTINCT cbi.event_id ' +
        '    FROM cb_time_intervals AS cbi' +
        '    WHERE ' +
        '         (cbi.time_from >= $1 AND cbi.time_from < $2 AND cbi.time_to IS NULL) ' +
        '      OR (cbi.time_from <= $1 AND cbi.time_to > $1)' +
        '      OR (cbi.time_from >= $1 AND cbi.time_to < $2) ' +
        '      OR (cbi.time_from <= $2 AND cbi.time_to > $2)' +
        '   )' +
        '   AND cb.category = $3' +
        '   AND cb.is_anytime = false' +
        ' ORDER BY cb.rating DESC, random() ' +
        ' LIMIT $4'

    const secondaryEvents = '' +
        ' SELECT' +
        '     top30.*' +
        ' FROM' +
        '     (' +
        '     SELECT' +
        '         cb.*' +
        '     FROM' +
        '         cb_events cb' +
        '     WHERE' +
        '         cb.category = $3' +
        '         AND cb.is_anytime = TRUE' +
        '     ORDER BY' +
        '         cb.rating DESC' +
        '     LIMIT 30 ) AS top30' +
        ' ORDER BY' +
        '     RANDOM()' +
        ' LIMIT $4'

    const finalQuery = `` +
    ` (${primaryEvents}) UNION ALL (${secondaryEvents}) LIMIT $4`

    return await db.any(finalQuery,
        [
            adjustedIntervals[0].toDate(), // $1
            adjustedIntervals[1].toDate(), // $2
            category.toString(), // $3
            limit // $4
    ]) as Event[];
}

async function loadTags(cat: TagCategory) {
    return await db.map('' +
        ' SELECT t.name ' +
        ' FROM cb_tags t' +
        ' WHERE t.category = $1' +
        ' ORDER BY t.name', [cat], (row) => row.name) as string[];
}

export async function loadAllCennosti(): Promise<string[]> {
    return await loadTags('tag_level_2')
}

export async function loadAllOblasti(): Promise<string[]> {
    return await loadTags('tag_level_1')
}