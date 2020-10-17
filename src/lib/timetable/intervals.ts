import { parseISO } from 'date-fns'
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
import { MyInterval } from '../../interfaces/app-interfaces'
import flow from 'lodash/fp/flow'

type DayTime = string | [string, string]
export type DateRange = [string, string]
export type DateOrDateRange = [string] | [string, string]


export interface DateExact {
    dateRange: DateOrDateRange
    times: DayTime[]
}

export interface WeekTime {
    weekdays: number[]
    times: DayTime[]
}

export interface DateRangeTimetable {
    dateRange?: DateRange
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


function toDateOrUndefined(dateStr: string) {
    if (dateStr === undefined) return undefined
    return parseISO(dateStr)
}


export function subDateRange([fromIncl, toIncl]: DateOrDateRange, dateFromStr: string, daysahead: number): MyInterval {
    if (toIncl === undefined) {
        toIncl = fromIncl
    }
    if (dateFromStr > toIncl) return undefined
    if (dateFromStr > fromIncl) fromIncl = dateFromStr
    // TODO +7 day

    const dateFrom = toDateOrUndefined(fromIncl)
    const dateTo = addDays(1)(toDateOrUndefined(toIncl))

    const intervalLen = differenceInCalendarDays(dateFrom, dateTo);

    if (intervalLen > daysahead) {
        return { start: dateFrom, end: addDays(intervalLen - daysahead)(dateTo) }
    } else {
        return { start: dateFrom, end: dateTo }
    }
}

function addHourAndMin(t: string) {
    const [h, m] = t.split(':');
    return flow(addHours(+h), addMinutes(+m))
}

function findTimesToday(weekTimes: WeekTime[], d: Date): DayTime[] {
    return weekTimes
        .filter(wt => wt.weekdays.includes(getISODay(d)))
        .flatMap(wt => wt.times);
}


/**
 * Cuts i interval, so it will fit into restrict (when inRange = in)
 */
function filterOneMoment(i: MomentOrInterval, restrict: MyInterval, inRange: 'in' | 'out'): (MomentOrInterval)[] {
    if (Array.isArray(i)) {
        const [start, end] = i;


        const isInSide = start >= restrict.start && end <= restrict.end
        const isOutSide = end < restrict.start || start > restrict.end
        if ((isInSide && inRange === 'out') || (isOutSide && inRange === 'in')) {
            return [undefined]
        }
        if ((isInSide && inRange === 'in') || (isOutSide && inRange === 'out')) {
            return [i]
        }

        if (inRange === 'in') {
            return [[
                max([start, restrict.start]),
                min([end, restrict.end])
            ]];
        } else {
            const isInsideRestrict = start < restrict.start && end > restrict.end
            if (isInsideRestrict) {
                return [
                    [start, restrict.start],
                    [restrict.end, end]
                ];
            }
            if (start < restrict.start) {
                //       [rStart------------rEnd)
                //   [start----------end)
                return [[start, restrict.start]];
            } else {
                //   [rStart-----------rEnd)
                //            [start----------end)
                return [[restrict.end, end]];
            }
        }
    } else if (isWithinIntervalHalfOpen(restrict, i) == (inRange === 'in')) {
        return [i]
    }
    return [undefined]
}

function isWithinIntervalHalfOpen(interval: MyInterval, date: Date) {
    return date.getTime() >= interval.start.getTime() && date.getTime() < interval.end.getTime()
}

// [)
export function filterByRange(a: MomentIntervals, restrict: MyInterval, inRange: 'in' | 'out'): MomentIntervals {
    return a
        .flatMap(i => {
            return filterOneMoment(i, restrict, inRange)
        })
        .filter(s => s !== undefined)
}

function intervalToToMoment(dr: DateRange): MyInterval {
    return {
        start: toDateOrUndefined(dr[0]),
        end: toDateOrUndefined(dr[1])
    }
}

export function mapInterval<T, U>(m: T|T[], mapper: (v: T) => U): U|U[] {
    if (Array.isArray(m)) {
        return m.map(mapper)
    }
    return mapper(m)
}

export function predictIntervals(startTime: Date, timetable: Partial<EventTimetable>, daysAhead: number) {
    const gen = new IntervalGenerator(startTime, daysAhead)
    return gen.generate(timetable)
}

export class IntervalGenerator {
    private readonly fromTime: Date
    private readonly daysAhead: number

    constructor(time: Date, daysAhead: number = 7) {
        this.daysAhead = daysAhead
        this.fromTime = time
    }

    generate(timetable: Partial<EventTimetable>): MomentIntervals {
        let intervals: MomentIntervals = []
        if (timetable === undefined) return undefined

        const restrictedRange: MyInterval = {
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

        intervals = this.flatIntervalsDatesExact(intervals, timetable.datesExact);

        intervals.sort((a: MomentOrInterval, b: MomentOrInterval) => {
            const am: Date = Array.isArray(a) ? a[0] : a
            const bm: Date = Array.isArray(b) ? b[0] : b
            return compareDesc(am, bm)
        })

        return filterByRange(intervals, restrictedRange, 'in')
    }

    private flatIntervalsWeekdays(time: Date, weekTimes: WeekTime[]): MomentIntervals {
        const initialDate = startOfDay(time)
        const intervals: MomentIntervals = []

        for (let i = 0; i < this.daysAhead; i++) {
            const d = addDays(i)(initialDate);
            const times = findTimesToday(weekTimes || [], d)
            intervals.push.apply(intervals, times.map(t => mapInterval(t, (st) => {
                return addHourAndMin(st)(d)
            })));
        }
        return intervals;
    }

    private flatIntervalsDatesExact(intervals: MomentIntervals, datesExact: DateExact[]): MomentIntervals {

        const dateStr = format('yyyy-MM-dd', this.fromTime)

        for (const {dateRange, times} of (datesExact || [])) {
            const start = toDateOrUndefined(dateRange[0])
            const end = toDateOrUndefined(dateRange[1]) || addDays(1)(start)

            intervals = filterByRange(intervals, { start, end }, 'out')

            const interval = subDateRange(dateRange, dateStr, this.daysAhead)
            if (interval === undefined) continue

            for (let d: Date = interval.start; d < interval.end; d = addDays(1)(d)) {
                for (const t of times) {
                    intervals.push(mapInterval(t, st => addHourAndMin(st)(d)))
                }
            }
        }
        return intervals
    }

    private flatIntervalsDateRangeTimetable(intervals: MomentIntervals, rangeTimetables: DateRangeTimetable[]): MomentIntervals {
        const dateStr = format('yyyy-MM-dd', this.fromTime)

        for (const {dateRange, times, weekTimes} of (rangeTimetables || [])) {
            const subRange = subDateRange(dateRange, dateStr, this.daysAhead)

            // clear old timetable in that interval
            intervals = filterByRange(intervals, subRange, 'out')

            if (subRange === undefined) continue
            const weekIntervals = this.flatIntervalsWeekdays(subRange.start, weekTimes)
            intervals = [...intervals, ...filterByRange(weekIntervals, subRange, 'in')]
            intervals = [...intervals, ...this.intervalsFromTime(subRange.start, subRange.end, times)]
        }
        return intervals
    }

    private intervalsFromTime(start: Date, end: Date, times: DayTime[]) {
        const timeIntervals: MomentIntervals = []
        for (let i = 0; i < this.daysAhead && addDays(i)(start) < end; i++) {
            timeIntervals.push.apply(timeIntervals, (times || []).map(t => {
                return mapInterval(t, st => flow(addDays(i), addHourAndMin(st))(start))
            }));
        }
        return timeIntervals
    }

}