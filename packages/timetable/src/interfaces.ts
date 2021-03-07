import { DayTime } from './intervals'

export type DateInterval = {
    start: Date
    end: Date
}
export type DateRange = [string, string]
export type DateOrDateRange = [string] | DateRange

export interface DateExact {
    dateRange: DateOrDateRange
    times: DayTime[]
}

export interface WeekTime {
    weekdays: number[]
    times: DayTime[]
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