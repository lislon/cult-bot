import { EventTimetable, MomentIntervals, predictIntervals, validateIntervals } from './intervals'
import { subWeeks } from 'date-fns/fp'
import { startOfISOWeek } from 'date-fns'
import { parseTimetable } from './parser'

export function cleanText(text: string) {
    const englishC = 'c'
    const russianC = 'с'
    return text.toLowerCase()
        .replace(englishC, russianC)
        .replace(/[—‑]/g, '-')
        .replace(/[ ]+/g, ' ')
        .replace(/[;\s]$/g, '')
        .trim()
        ;
}

export function getOnlyBotTimetable(timetable: string): string {
    let botTimetable = timetable
        .replace(/[(].+?[)]/g, '')

    const matches = botTimetable.match(/{(?:бот|bot):([^}]+)}/)
    if (matches) {
        botTimetable = matches[1]
    }
    return botTimetable
}

export interface ParseAndPredictTimetableResult {
    errors: string[]
    timeIntervals: MomentIntervals
    timetable?: EventTimetable

}

export function parseAndPredictTimetable(rawTimetable: string, now: Date): ParseAndPredictTimetableResult {
    const result: ParseAndPredictTimetableResult = {
        errors: [],
        timetable: undefined,
        timeIntervals: []
    }

    const timetable = parseTimetable(getOnlyBotTimetable(rawTimetable), now);
    if (timetable.status === true) {

        // TODO: Timzezone
        const WEEKS_AGO = 2
        const WEEKS_AHEAD = 4
        const dateFrom = subWeeks(WEEKS_AGO)(startOfISOWeek(now))

        result.timeIntervals = predictIntervals(dateFrom, timetable.value, (WEEKS_AGO + WEEKS_AHEAD) * 7)
        result.timetable = timetable.value
        const errors = validateIntervals(result.timeIntervals)
        if (errors.length > 0) {
            result.errors = errors
        }
    } else {
        result.errors = timetable.errors
    }
    return result
}