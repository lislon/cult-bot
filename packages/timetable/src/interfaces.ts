import { DayTime } from './intervals'

export type DateInterval = {
    start: Date
    end: Date
}
export type SingleDate = string
export type DateRange = [string, string]
export type DateOrDateRange = SingleDate | DateRange

export function isDateRange(dateOrDateRange: DateOrDateRange): dateOrDateRange is DateRange {
    return Array.isArray(dateOrDateRange)
}
export function isSingleDate(dateOrDateRange: DateOrDateRange): dateOrDateRange is SingleDate {
    return typeof dateOrDateRange === 'string'
}

export interface DateExact {
    date: SingleDate
    times: DayTime[]
    comment?: string
}

export interface WeekTime {
    weekdays: number[]
    times: DayTime[]
    comment?: string
}

export interface DateRangeTimetable {
    dateRange: DateRange
    weekTimes?: WeekTime[]    // по-недельно
    times?: DayTime[]         // ежедневно часы
}

export interface EventTimetable {
    weekTimes?: WeekTime[]
    dateRangesTimetable?: DateRangeTimetable[]
    datesExact?: DateExact[]
    anytime?: boolean
}

export type MomentOrInterval = Date | Date[];
export type MomentIntervals = MomentOrInterval[]