import { Moment } from 'moment'
import { db } from '../db'
import { Event, EventCategory } from '../interfaces/app-interfaces'

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

export async function findTopEventsInRange(category: EventCategory, interval: Moment[]): Promise<Event[]> {
    return await db.any('' +
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
        ' LIMIT 3', [interval[0].toDate(), interval[1].toDate(), category.toString()]) as Event[];
}