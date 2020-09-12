import moment, { duration, Moment } from 'moment'

const DAYS_AHEAD = 7;

type DayTime = string | [string, string]
type DateRange = [string, string]
type DateOrDateRange = [string] | [string, string]


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

export interface EventDate {
    weekTimes?: WeekTime[]
    dateRangesTimetable?: DateRangeTimetable[]
    datesExact?: DateExact[]
    anytime?: boolean
}
export type MomentOrInterval = Moment | Moment[];
export type MomentIntervals = MomentOrInterval[]


function toMoment(date: string) {
    if (date === undefined) return undefined
    return moment(date, 'YYYY-MM-DD')
}

function subDateRange([fromIncl, toIncl]: DateOrDateRange, dateFrom: string) {
    if (toIncl === undefined) {
        toIncl = fromIncl
    }
    if (dateFrom > toIncl) return []
    if (dateFrom > fromIncl) fromIncl = dateFrom
    // TODO +7 day

    const momentFrom = toMoment(fromIncl)
    const momentTo = toMoment(toIncl).add(1, 'd')


    const intervalLen = duration(momentTo.diff(momentFrom)).asDays();

    if (intervalLen > DAYS_AHEAD) {
        momentTo.subtract(intervalLen - DAYS_AHEAD, 'd')
    }

    return [momentFrom, momentTo]
}

function timeToStruct(t: string) {
    const [h, m] = t.split(':');
    return {hours: +h, minutes: +m}
}

function findTimesToday(weekTimes: WeekTime[], d: moment.Moment): DayTime[] {
    return weekTimes
        .filter(wt => wt.weekdays.includes(d.weekday()))
        .flatMap(wt => wt.times);
}



function flatIntervalsDatesExact(intervals: MomentIntervals, time: Moment, datesExact: DateExact[]): MomentIntervals {

    const dateStr = time.format('YYYY-MM-DD')

    for (const {dateRange, times} of (datesExact || [])) {
        const from = toMoment(dateRange[0])
        const to = toMoment(dateRange[1]) || from.clone().add(1, 'd')

        intervals = filterByByRange(intervals, [from, to], 'out')

        const [fromIncl, toExcl] = subDateRange(dateRange, dateStr)
        if (!fromIncl) continue

        for (const d: Moment = fromIncl; d.isBefore(toExcl); d.add(1, 'd')) {
            for (const t of times) {
                intervals.push(mapInterval(t, st => d.clone().add(timeToStruct(st))))
            }
        }
    }
    return intervals
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

function intervalsFromTime(d: Moment, endExcl: Moment, times: DayTime[]) {
    const timeIntervals: MomentIntervals = []
    for (let i = 0; i < DAYS_AHEAD && d.isBefore(endExcl); i++, d.add(1, 'd')) {
        timeIntervals.push.apply(timeIntervals, (times || []).flatMap(t => {
            return mapInterval(t, st => d.clone().add(timeToStruct(st)))
        }));
    }
    return timeIntervals
}

function flatIntervalsDateRangeTimetable(time: Moment, rangeTimetables: DateRangeTimetable[]): MomentIntervals {
    const intervals: MomentIntervals = []

    const dateStr = time.format('YYYY-MM-DD')

    for (const {dateRange, times, weekTimes} of (rangeTimetables || [])) {
        const [startIncl, endExcl] = subDateRange(dateRange, dateStr)

        const weekIntervals = flatIntervalsWeekdays(startIncl, weekTimes)
        intervals.push.apply(intervals, filterByByRange(weekIntervals, [startIncl, endExcl], 'in'));

        const d = startIncl.clone()

        intervals.push.apply(intervals, intervalsFromTime(d, endExcl, times));

    }
    return intervals
}

function flatIntervalsWeekdays(time: Moment, weekTimes: WeekTime[]): MomentIntervals {
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

function intervalToToMoment(dr: DateRange): [Moment, Moment] {
    return [toMoment(dr[0]), toMoment(dr[1])]
}

export function mapInterval<T, U>(m: T|T[], mapper: (v: T) => U): U|U[] {
    if (Array.isArray(m)) {
        return m.map(mapper)
    }
    return mapper(m)
}

export function predictIntervals(time: Moment, timetable: Partial<EventDate>) {
    let intervals: MomentIntervals = []
    // console.log(JSON.stringify(timetable, undefined, 2))

    const regularWeekTimes = flatIntervalsWeekdays(time, timetable.weekTimes)

    const filteredRegularWeekTimes = (timetable.dateRangesTimetable || [])
        .reduce((ints, dr) => filterByByRange(ints, intervalToToMoment(dr.dateRange), 'out'), regularWeekTimes)


    intervals.push.apply(intervals, filteredRegularWeekTimes);
    intervals.push.apply(intervals, flatIntervalsDateRangeTimetable(time, timetable.dateRangesTimetable));

    intervals = flatIntervalsDatesExact(intervals, time, timetable.datesExact);

    if (timetable.anytime) {
        intervals = [[time, time.clone().startOf('day').add(DAYS_AHEAD, 'd')]]
    }

    intervals.sort((a: MomentOrInterval, b: MomentOrInterval) => {
        const am: Moment = Array.isArray(a) ? a[0] : a
        const bm: Moment = Array.isArray(b) ? b[0] : b
        return am.diff(bm)
    })

    const final = filterByByRange(intervals, [time, time.clone().startOf('day').add(DAYS_AHEAD, 'd')], 'in')

    return final
}