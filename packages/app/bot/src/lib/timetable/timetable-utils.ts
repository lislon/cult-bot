import { subWeeks } from 'date-fns/fp'
import { startOfISOWeek } from 'date-fns'
import {
    EventTimetable,
    MomentIntervals, parseTimetable,
    predictIntervals, validateIntervals
} from '@culthub/timetable'

export function getOnlyBotTimetable(timetable: string): string {
    const matches = timetable.match(/{(?:бот|bot):([^}]+)}/)
    if (matches) {
        return matches[1]
    }
    return timetable
}

export interface ParseAndPredictTimetableResult {
    errors: string[]
    predictedIntervals: MomentIntervals
    parsedTimetable?: EventTimetable
}

type PredictTimetableConfig = { SCHEDULE_DAYS_AGO: number, SCHEDULE_DAYS_AHEAD: number }

export function parseAndPredictTimetable(rawTimetable: string, now: Date, config: PredictTimetableConfig): ParseAndPredictTimetableResult {
    const result: ParseAndPredictTimetableResult = {
        errors: [],
        parsedTimetable: undefined,
        predictedIntervals: []
    }

    const timetable = parseTimetable(getOnlyBotTimetable(rawTimetable), now)
    if (timetable.status === true) {

        // TODO: Timzezone
        const dateFrom = subWeeks(config.SCHEDULE_DAYS_AGO)(startOfISOWeek(now))

        result.predictedIntervals = predictIntervals(dateFrom, timetable.value, (config.SCHEDULE_DAYS_AGO + config.SCHEDULE_DAYS_AHEAD) * 7)
        result.parsedTimetable = timetable.value
        const errors = validateIntervals(result.predictedIntervals)
        if (errors.length > 0) {
            result.errors = errors
        }
    } else {
        result.errors = timetable.errors
    }
    return result
}