import moment, { duration, Moment } from 'moment'
import { mskMoment } from '../../util/moment-msk'

const DAYS_AHEAD = 7;

type DayTime = string | [string, string]
type DateRange = [string, string]
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
export type MomentOrInterval = Moment | Moment[];
export type MomentIntervals = MomentOrInterval[]


function toMoment(date: string) {
    if (date === undefined) return undefined
    return mskMoment(date, 'YYYY-MM-DD')
}


export function subDateRange([fromIncl, toIncl]: DateOrDateRange, dateFrom: string, daysahead = DAYS_AHEAD) {
    if (toIncl === undefined) {
        toIncl = fromIncl
    }
    if (dateFrom > toIncl) return []
    if (dateFrom > fromIncl) fromIncl = dateFrom
    // TODO +7 day

    const momentFrom = toMoment(fromIncl)
    if (!momentFrom.isValid()) {
        throw new Error(`Дата "${fromIncl}" не может существовать`)
    }
    const momentTo = toMoment(toIncl).add(1, 'd')
    if (!momentTo.isValid()) {
        throw new Error(`Дата "${toIncl}" не может существовать`)
    }

    const intervalLen = duration(momentTo.diff(momentFrom)).asDays();

    if (intervalLen > daysahead) {
        momentTo.subtract(intervalLen - daysahead, 'd')
    }

    return [momentFrom, momentTo]
}

function timeToStruct(t: string) {
    const [h, m] = t.split(':');
    return {hours: +h, minutes: +m}
}

function findTimesToday(weekTimes: WeekTime[], d: moment.Moment): DayTime[] {
    return weekTimes
        .filter(wt => wt.weekdays.includes(d.isoWeekday()))
        .flatMap(wt => wt.times);
}



function filterOneMoment(i: MomentOrInterval, restrictStart: Moment, restrictEnd: Moment, inRange: 'in' | 'out'): (MomentOrInterval)[] {
    if (Array.isArray(i)) {
        const [start, end] = i;


        const isInSide = start.isSameOrAfter(restrictStart) && end.isSameOrBefore(restrictEnd)
        const isOutSide = end.isBefore(restrictStart) || start.isAfter(restrictEnd)
        if ((isInSide && inRange === 'out') || (isOutSide && inRange === 'in')) {
            return [undefined]
        }
        if ((isInSide && inRange === 'in') || (isOutSide && inRange === 'out')) {
            return [i]
        }

        if (inRange === 'in') {
            return [[
                moment.max([start, restrictStart]),
                moment.min([end, restrictEnd])
            ]];
        } else {
            const isInsideRestrict = start.isBefore(restrictStart) && end.isAfter(restrictEnd)
            if (isInsideRestrict) {
                return [
                    [start, restrictStart],
                    [restrictEnd, end]
                ];
            }
            if (start < restrictStart) {
                //       [rStart------------rEnd)
                //   [start----------end)
                return [[start, restrictStart]];
            } else {
                //   [rStart-----------rEnd)
                //            [start----------end)
                return [[restrictEnd, end]];
            }
        }
    } else if (i.isBetween(restrictStart, restrictEnd, 'm', '[)') == (inRange === 'in')) {
        return [i]
    }
    return [undefined]
}

// [)
export function filterByByRange(a: MomentIntervals, [restrictStart, restrictEnd]: [Moment, Moment], inRange: 'in' | 'out'): MomentIntervals {
    return a
        .flatMap(i => {
            return filterOneMoment(i, restrictStart, restrictEnd, inRange)
        })
        .filter(s => s !== undefined)
}


function intervalToToMoment(dr: DateRange): [Moment, Moment] {
    return [toMoment(dr[0]), toMoment(dr[1])]
}

export function mapInterval<T, U>(m: T|T[], mapper: (v: T) => U): U|U[] {
    if (Array.isArray(m)) {
        return m.map(mapper)
    }
    return mapper(m)
}

export function predictIntervals(time: Moment, timetable: Partial<EventTimetable>, daysAhead = DAYS_AHEAD) {
    return new IntervalGenerator(time, daysAhead).generate(timetable)
}

export class IntervalGenerator {
    private readonly fromTime: Moment
    private readonly daysAhead: number

    constructor(time: Moment, daysAhead: number = 7) {
        this.daysAhead = daysAhead
        this.fromTime = time.clone()
    }

    generate(timetable: Partial<EventTimetable>): MomentIntervals {
        let intervals: MomentIntervals = []
        if (timetable === undefined) return undefined
        // console.log(JSON.stringify(timetable, undefined, 2))

        const regularWeekTimes = this.flatIntervalsWeekdays(this.fromTime, timetable.weekTimes)

        const filteredRegularWeekTimes = (timetable.dateRangesTimetable || [])
            .reduce((ints, dr) => filterByByRange(ints, intervalToToMoment(dr.dateRange), 'out'), regularWeekTimes)


        intervals.push.apply(intervals, filteredRegularWeekTimes);
        intervals.push.apply(intervals, this.flatIntervalsDateRangeTimetable(timetable.dateRangesTimetable));

        intervals = this.flatIntervalsDatesExact(intervals, timetable.datesExact);

        const restrictedRange: [moment.Moment, moment.Moment] = [
            this.fromTime,
            this.fromTime.clone().startOf('day').add(this.daysAhead, 'd')
        ]
        if (timetable.anytime) {
            return [restrictedRange]
        } else {

            intervals.sort((a: MomentOrInterval, b: MomentOrInterval) => {
                const am: Moment = Array.isArray(a) ? a[0] : a
                const bm: Moment = Array.isArray(b) ? b[0] : b
                return am.diff(bm)
            })

            return filterByByRange(intervals, restrictedRange, 'in')
        }
    }

    private flatIntervalsWeekdays(time: Moment, weekTimes: WeekTime[]): MomentIntervals {
        const d = time.clone().startOf('day')
        const intervals: MomentIntervals = []

        for (let i = 0; i < DAYS_AHEAD; i++, d.add(1, 'd')) {
            const times = findTimesToday(weekTimes || [], d)
            intervals.push.apply(intervals, times.map(t => mapInterval(t, (st) => {
                return  d.clone().add(timeToStruct(st))
            })));
        }
        return intervals;
    }

    private flatIntervalsDatesExact(intervals: MomentIntervals, datesExact: DateExact[]): MomentIntervals {

        const dateStr = this.fromTime.format('YYYY-MM-DD')

        for (const {dateRange, times} of (datesExact || [])) {
            const from = toMoment(dateRange[0])
            const to = toMoment(dateRange[1]) || from.clone().add(1, 'd')

            intervals = filterByByRange(intervals, [from, to], 'out')

            const [fromIncl, toExcl] = subDateRange(dateRange, dateStr, this.daysAhead)
            if (!fromIncl) continue

            for (const d: Moment = fromIncl; d.isBefore(toExcl); d.add(1, 'd')) {
                for (const t of times) {
                    intervals.push(mapInterval(t, st => d.clone().add(timeToStruct(st))))
                }
            }
        }
        return intervals
    }

    private flatIntervalsDateRangeTimetable(rangeTimetables: DateRangeTimetable[]): MomentIntervals {
        const intervals: MomentIntervals = []

        const dateStr = this.fromTime.format('YYYY-MM-DD')

        for (const {dateRange, times, weekTimes} of (rangeTimetables || [])) {
            const [startIncl, endExcl] = subDateRange(dateRange, dateStr)

            const weekIntervals = this.flatIntervalsWeekdays(startIncl, weekTimes)
            intervals.push.apply(intervals, filterByByRange(weekIntervals, [startIncl, endExcl], 'in'));

            const d = startIncl.clone()

            intervals.push.apply(intervals, this.intervalsFromTime(d, endExcl, times));

        }
        return intervals
    }

    private intervalsFromTime(d: Moment, endExcl: Moment, times: DayTime[]) {
        const timeIntervals: MomentIntervals = []
        for (let i = 0; i < DAYS_AHEAD && d.isBefore(endExcl); i++, d.add(1, 'd')) {
            timeIntervals.push.apply(timeIntervals, (times || []).map(t => {
                return mapInterval(t, st => d.clone().add(timeToStruct(st)))
            }));
        }
        return timeIntervals
    }

}