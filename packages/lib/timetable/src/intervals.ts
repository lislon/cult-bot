import { formatISO, parseISO } from 'date-fns'
import {
    addDays,
    addHours,
    addMinutes,
    compareDesc,
    differenceInCalendarDays,
    format,
    getISODay,
    max,
    min,
    startOfDay
} from 'date-fns/fp'
import flow from 'lodash/fp/flow'
import {
    DateExact,
    DateInterval,
    DateOrDateRange,
    DateRange,
    DateRangeTimetable,
    EventTimetable, isDateRange,
    MomentIntervals,
    MomentOrInterval,
    WeekTime
} from './interfaces'

export type DayTime = string | [string, string]

export function rightDate<T>(q: T | T[]): T
export function rightDate<T>(q: T | [T, T]): T {
    return Array.isArray(q) ? q[1] : q
}

export function leftDate<T>(q: T | T[]): T
export function leftDate<T>(q: T | [T, T]): T {
    return Array.isArray(q) ? q[0] : q
}

function toDateOrUndefined(dateStr: string): Date
function toDateOrUndefined(dateStr?: string) {
    if (dateStr === undefined) return undefined
    return parseISO(dateStr)
}


export function subDateRange(dateOrDateRange: DateOrDateRange, dateFromStr: string, daysahead: number): DateInterval | undefined {
    let fromIncl = isDateRange(dateOrDateRange) ? dateOrDateRange[0] : dateOrDateRange
    const toIncl = isDateRange(dateOrDateRange) ? dateOrDateRange[1] : dateOrDateRange

    if (dateFromStr > toIncl) return undefined
    if (dateFromStr > fromIncl) fromIncl = dateFromStr
    // TODO +7 day

    const dateFrom = toDateOrUndefined(fromIncl)
    const dateTo2 = toDateOrUndefined(toIncl)
    if (dateFrom === undefined || dateTo2 === undefined) {
        throw new Error('wtf')
    }

    const dateTo = addDays(1)(dateTo2)

    const intervalLen = differenceInCalendarDays(dateFrom, dateTo)

    if (intervalLen > daysahead) {
        return {start: dateFrom, end: addDays(intervalLen - daysahead)(dateTo)}
    } else {
        return {start: dateFrom, end: dateTo}
    }
}

function addHourAndMin(t: string) {
    const [h, m] = t.split(':')
    return flow(addHours(+h), addMinutes(+m))
}

function findTimesToday(weekTimes: WeekTime[], d: Date): DayTime[] {
    return weekTimes
        .filter(wt => wt.weekdays.includes(getISODay(d)))
        .flatMap(wt => wt.times)
}


/**
 * Cuts i interval, so it will fit into restrict (when inRange = in)
 */
function filterOneMoment(i: MomentOrInterval, restrict: DateInterval, inRange: 'in' | 'out'): (MomentOrInterval | undefined)[] {
    if (Array.isArray(i)) {
        const [start, end] = i


        const isInSide = start >= restrict.start && end <= restrict.end
        const isOutSide = end < restrict.start || start > restrict.end
        if ((isInSide && inRange === 'out') || (isOutSide && inRange === 'in')) {
            return [undefined]
        }
        if ((isInSide && inRange === 'in') || (isOutSide && inRange === 'out')) {
            return [i]
        }

        if (inRange === 'in') {
            const from = max([start, restrict.start])
            const to = min([end, restrict.end])
            if (from.getTime() !== to.getTime()) {
                return [[from, to]]
            } else {
                return [undefined]
            }
        } else {
            const isInsideRestrict = start < restrict.start && end > restrict.end
            if (isInsideRestrict) {
                return [
                    [start, restrict.start],
                    [restrict.end, end]
                ]
            }
            if (start < restrict.start) {
                //       [rStart------------rEnd)
                //   [start----------end)
                return [[start, restrict.start]]
            } else {
                //   [rStart-----------rEnd)
                //            [start----------end)
                return [[restrict.end, end]]
            }
        }
    } else if (isWithinIntervalHalfOpen(restrict, i) == (inRange === 'in')) {
        return [i]
    }
    return [undefined]
}

function isWithinIntervalHalfOpen(interval: DateInterval, date: Date) {
    return date.getTime() >= interval.start.getTime() && date.getTime() < interval.end.getTime()
}

function notUndefined<TValue>(value: TValue | null | undefined): value is TValue {
    return value !== undefined
}

// [)
export function filterByRange(intervals: MomentIntervals, restrict: DateInterval, inRange: 'in' | 'out'): MomentIntervals {
    const flatMap: (Date | Date[] | undefined)[] = intervals
        .flatMap((i: Date | Date[]) => {
            return filterOneMoment(i, restrict, inRange)
        })
    return flatMap.filter(notUndefined)
}

function intervalToToMoment(dr: DateRange): DateInterval {
    return {
        start: toDateOrUndefined(dr[0]),
        end: toDateOrUndefined(dr[1])
    }
}

// export function mapInterval<T, U>(m: T, mapper: (v: T) => U): U;
export function mapInterval<T, U>(m: [T, T], mapper: (v: T) => U): [U, U];
export function mapInterval<T, U>(m: [T], mapper: (v: T) => U): [U]
export function mapInterval<T, U>(m: [T] | [T, T], mapper: (v: T) => U): [U] | [U, U]
export function mapInterval<T, U>(m: T | [T, T], mapper: (v: T) => U): U | [U, U]
export function mapInterval<T, U>(m: T | T[], mapper: (v: T) => U): U | U[]
export function mapInterval<T, U>(m: T | T[], mapper: (v: T) => U): U | U[] {
    if (Array.isArray(m)) {
        return m.map(mapper)
    }
    return mapper(m)
}

export function predictIntervals(startTime: Date, timetable: Partial<EventTimetable>, daysAhead: number): MomentOrInterval[] {
    const gen = new IntervalGenerator(startTime, daysAhead)
    return gen.generate(timetable)
}

export function validateIntervals(intervals: MomentOrInterval[]): string[] {
    const errors = []
    let last: Date | undefined = undefined

    for (const i of intervals) {
        if (Array.isArray(i)) {
            if (i[0] >= i[1]) {
                errors.push(`Неверный порядок дат. ${formatISO(i[0])}  должен быть перед ${formatISO(i[1])}`)
            }
            if (last !== undefined && last > i[0]) {
                errors.push(`Неверный порядок дат. Повторяющиеся или интервалы в неверном порядке: ${formatISO(i[0])} должен быть перед ${formatISO(last)}`)
            }
            last = i[1]
        } else {
            if (last !== undefined && last > i) {
                errors.push(`Неверный порядок дат. Повторяющиеся или интервалы в неверном порядке. ${formatISO(i)} должен быть перед ${formatISO(last)}`)
            }
            last = i
        }
    }
    return errors
}

export class IntervalGenerator {
    private readonly fromTime: Date
    private readonly daysAhead: number

    constructor(time: Date, daysAhead = 7) {
        this.daysAhead = daysAhead
        this.fromTime = time
    }

    generate(timetable: Partial<EventTimetable>): MomentIntervals {
        let intervals: MomentIntervals = []

        const restrictedRange: DateInterval = {
            start: this.fromTime,
            end: flow(startOfDay, addDays(this.daysAhead))(this.fromTime)
        }

        if (timetable.anytime) {
            return [[restrictedRange.start, restrictedRange.end]]
        }

        const regularWeekTimes = this.flatIntervalsWeekdays(this.fromTime, timetable.weekTimes)

        const filteredRegularWeekTimes = (timetable.dateRangesTimetable || [])
            .reduce((ints, dr) => filterByRange(ints, intervalToToMoment(dr.dateRange), 'out'), regularWeekTimes)


        intervals = [...intervals, ...filteredRegularWeekTimes]
        intervals = this.flatIntervalsDateRangeTimetable(intervals, timetable.dateRangesTimetable)

        intervals = this.flatIntervalsDatesExact(intervals, timetable.datesExact)

        intervals.sort((a: MomentOrInterval, b: MomentOrInterval) => {
            const am: Date = Array.isArray(a) ? a[0] : a
            const bm: Date = Array.isArray(b) ? b[0] : b
            return compareDesc(am, bm)
        })

        return filterByRange(intervals, restrictedRange, 'in')
    }

    private flatIntervalsWeekdays(time: Date, weekTimes?: WeekTime[]): MomentIntervals {
        const initialDate = startOfDay(time)
        let intervals: MomentIntervals = []

        for (let i = 0; i < this.daysAhead; i++) {
            const d = addDays(i)(initialDate)
            const times = findTimesToday(weekTimes || [], d)
            intervals = [...intervals, ...times.map(t => mapInterval(t, (st) => {
                return addHourAndMin(st)(d)
            }))]
        }
        return intervals
    }

    private flatIntervalsDatesExact(intervals: MomentIntervals, datesExact?: DateExact[]): MomentIntervals {

        const dateStr = format('yyyy-MM-dd', this.fromTime)

        for (const {date, times} of (datesExact || [])) {

            const start = parseISO(isDateRange(date) ? date[0] : date)
            const end = isDateRange(date) ? parseISO(date[1]) : addDays(1)(start)

            intervals = filterByRange(intervals, {start, end}, 'out')

            const interval = subDateRange(date, dateStr, this.daysAhead)
            if (interval === undefined) continue

            for (let d: Date = interval.start; d < interval.end; d = addDays(1)(d)) {
                for (const t of times) {
                    intervals.push(mapInterval(t, st => addHourAndMin(st)(d)))
                }
            }
        }
        return intervals
    }

    private flatIntervalsDateRangeTimetable(intervals: MomentIntervals, rangeTimetables?: DateRangeTimetable[]): MomentIntervals {
        const dateStr = format('yyyy-MM-dd', this.fromTime)

        for (const {dateRange, times, weekTimes} of (rangeTimetables || [])) {
            const subRange = subDateRange(dateRange, dateStr, this.daysAhead)

            if (subRange === undefined) continue

            // clear old timetable in that interval
            intervals = filterByRange(intervals, subRange, 'out')

            const weekIntervals = this.flatIntervalsWeekdays(subRange.start, weekTimes)
            intervals = [...intervals, ...filterByRange(weekIntervals, subRange, 'in')]
            intervals = [...intervals, ...this.intervalsFromTime(subRange.start, subRange.end, times)]
        }
        return intervals
    }

    private intervalsFromTime(start: Date, end: Date, times?: DayTime[]) {
        let timeIntervals: MomentIntervals = []
        for (let i = 0; i < this.daysAhead && addDays(i)(start) < end; i++) {
            timeIntervals = [...timeIntervals, ...(times || []).map(t => {
                return mapInterval(t, st => flow(addDays(i), addHourAndMin(st))(start))
            })]
        }
        return timeIntervals
    }

}
