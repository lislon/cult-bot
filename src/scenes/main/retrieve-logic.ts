import { EventCategory } from '../../interfaces/app-interfaces'
import { findTopEventsInRange } from '../../db/events'
import moment = require('moment')
import { Moment } from 'moment'

function getNextWeekEndRange(): [Moment, Moment] {
    const now = moment().tz('Europe/Moscow')
    const weekendStarts = moment().tz('Europe/Moscow')
        .startOf('week')
        .add(6, 'd')
    const weekendEnds = moment().tz('Europe/Moscow')
        .startOf('week')
        .add(8, 'd')
        .subtract(2, 'hour')

    return [moment.max(now, weekendStarts), weekendEnds]
}

export async function getTopEvents(cat: EventCategory) {
    const range = getNextWeekEndRange()
    const events = await findTopEventsInRange(cat, range);
    return {range, events}
}
