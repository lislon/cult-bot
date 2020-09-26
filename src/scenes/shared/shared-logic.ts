import { Moment } from 'moment'
import moment = require('moment')

export function getNextWeekEndRange(): [Moment, Moment] {
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