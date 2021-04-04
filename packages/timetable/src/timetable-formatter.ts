import { DayTime, rightDate } from './intervals'
import { ruFormat } from './ruFormat'
import { addDays, differenceInDays, format, formatISO, getISODay, getMonth, isAfter, isEqual, parseISO } from 'date-fns'
import {
    DateExact,
    DateOrDateRange,
    DateRangeTimetable,
    EventTimetable,
    isSingleDate,
    SingleDate,
    WeekTime
} from './interfaces'

export function hasAnyEventsInFuture(timetable: EventTimetable, now: Date): boolean {
    if (timetable.anytime || timetable.weekTimes.length) {
        return true
    }
    const isoDate = formatISO(now, {representation: 'date'})
    const isoTime = format(now, 'HH:mm')
    if (timetable.datesExact.find(d => hasDateTimeInFuture(d, isoDate, isoTime))) {
        return true
    }
    return !!timetable.dateRangesTimetable.find(({dateRange}) => rightDate(dateRange) > isoDate || (rightDate(dateRange) === isoDate))

}

function hasDateTimeInFuture(dateTimes: { date: SingleDate, times: DayTime[] }, isoDate: string, isoTime: string): boolean {
    if (dateTimes.date > isoDate) {
        return true
    }
    if (dateTimes.date === isoDate) {
        return !!dateTimes.times.find(t => rightDate(t) > isoTime)
    }
    return false
}


export interface FormattedTimetable {
    weekTimes: string[]
    dateRangesTimetable: {
        dateRange: string
        weekTimes: string[]
        times?: string
    }[]
    datesExact: {
        date: string
        times?: string
        comment?: string
    }[]
    anytime: string
}

export interface FormatterConfig {
    hidePast?: boolean
    hideTimes?: boolean
    hideNonHolidays?: boolean
    holidays?: Date[]
}

export class TimetableFormatter {

    private FIXED_MONDAY = new Date(2021, 1, 7)
    private DAYS_DIFF_TO_PRINT_YEAR = 180

    constructor(private now: Date, private config: FormatterConfig = {}) {

    }

    private formatTimes(times: DayTime[]): string {
        return times.map(time => {
            if (Array.isArray(time)) {
                if (time[0] === '00:00' && time[1] === '24:00') {
                    return `в любое время`
                }
                return `${time[0]}-${time[1]}`
            } else {
                return time
            }
        }).join(',')
    }

    private formatWeekdays(weekdays: number[]): string {
        const fmtSingle = (dayInWeek: number) =>
            ruFormat(addDays(this.FIXED_MONDAY, dayInWeek), 'eeeeee')

        let from = -1
        let prev = -1
        const result = []
        let isContinueSeq = false
        for (const cur of weekdays) {
            isContinueSeq = prev + 1 === cur
            if (from === -1) {
                from = cur
            } else {
                if (!isContinueSeq) {
                    if (from !== prev) {
                        result.push(`${fmtSingle(from)}-${fmtSingle(prev)}`)
                    } else {
                        result.push(fmtSingle(from))
                    }
                    from = cur
                }
            }
            prev = cur
        }
        if (isContinueSeq) {
            result.push(`${fmtSingle(from)}-${fmtSingle(prev)}`)
        } else {
            result.push(fmtSingle(from))
        }
        return result.join(',')
    }

    private static isEmptyDays(timetable: FormattedTimetable): boolean {
        return !timetable.anytime
            && !timetable.dateRangesTimetable.find(({ weekTimes, times }) => (weekTimes.length > 0) || times)
            && (timetable.datesExact.length === 0)
            && (timetable.weekTimes.length === 0)
    }

    formatTimetable(timetable: EventTimetable): string {
        const {anytime, datesExact, dateRangesTimetable, weekTimes} = this.structureFormatTimetable(timetable)

        if (anytime) {
            return anytime
        }
        const strWeekTimes = weekTimes.join('\n')
        const strDatesExact = datesExact
            .map(({date, times, comment}) =>
                `${this.joinDateAndTime(date, times)}${TimetableFormatter.maybeAppendComment(comment)}`
            )
            .join('\n')
        const strDateRangesTimetable =
            dateRangesTimetable.map(({dateRange, times, weekTimes}) => {
                    if (times !== undefined) {
                        return this.joinDateAndTime(dateRange, times)
                    } else {
                        return `${dateRange}: ${weekTimes.join(', ')}`
                    }
                })
                .join('\n')
        return [strWeekTimes, strDatesExact, strDateRangesTimetable]
            .filter(s => s !== '')
            .join('\n')
    }

    private joinDateAndTime(prefix: string, times?: string): string {
        if (this.config.hideTimes) {
            return `${prefix}`
        } else {
            return `${prefix}: ${times ?? ''}`
        }
    }

    structureFormatTimetable(timetable: EventTimetable): FormattedTimetable {
        const {anytime, datesExact, dateRangesTimetable, weekTimes} = timetable
        if (anytime) {
            return {
                anytime: `в любое время` + (timetable.anytimeComment ? ` (${timetable.anytimeComment})` : ''),
                weekTimes: [],
                datesExact: [],
                dateRangesTimetable: []
            }
        }
        const r = {
            anytime: '',
            weekTimes: this.formatWeekTimes(this.filterWorkdaysWeekTimes(weekTimes)),
            datesExact: this.formatDatesExact(this.filterWorkdaysDatesExact(datesExact)),
            dateRangesTimetable: this.formatDateRangesTimetable(dateRangesTimetable)
        }
        if (TimetableFormatter.isEmptyDays(r)) {
            if (this.config.hidePast) {
                return new TimetableFormatter(this.now, {
                    ...this.config,
                    hidePast: false
                }).structureFormatTimetable(timetable)
            }
            if (this.config.hideNonHolidays) {
                return new TimetableFormatter(this.now, {
                    ...this.config,
                    hideNonHolidays: false
                }).structureFormatTimetable(timetable)
            }
        }
        return r
    }
    private filterWorkdaysWeekTimes(weekTimes: WeekTime[]): WeekTime[] {
        if (this.config.hideNonHolidays) {
            const filterWeekDay = (weekday: number) => {
                if (this.config.holidays !== undefined) {
                    return this.config.holidays.map(d => getISODay(d)).includes(weekday)
                } else {
                    return weekday >= 6 && weekday <= 7
                }
            }
            return weekTimes.map(weekTime => ({
                ...weekTime,
                weekdays: weekTime.weekdays.filter(filterWeekDay),
            })).filter(({ weekdays }) => weekdays.length > 0)
        }
        return weekTimes;
    }

    private filterWorkdaysDatesExact(datesExact: DateExact[]): DateExact[] {
        if (this.config.hideNonHolidays) {
            return datesExact.filter(({ date }) => {
                const parsedDate = parseISO(date)
                if (this.config.holidays !== undefined) {
                    return !!this.config.holidays.find(holiday => isEqual(holiday, parsedDate))
                } else {
                    return getISODay(parsedDate) >= 6
                }
            })
        }
        return datesExact;
    }

    private formatDateRangesTimetable(dateRangesTimetable: DateRangeTimetable[]): FormattedTimetable['dateRangesTimetable'] {
        return dateRangesTimetable.map(({dateRange, weekTimes, times}) => {
                return {
                    dateRange: this.formatDateOrDateRange(dateRange),
                    weekTimes: this.formatWeekTimes(this.filterWorkdaysWeekTimes(weekTimes)),
                    times: times.length > 0 ? this.formatTimes(times) : undefined
                }
            }
        )
    }

    private formatWeekTimes(weekTimes: WeekTime[]): FormattedTimetable['weekTimes'] {
        return weekTimes.map(({weekdays, times, comment}) => {
            return this.joinDateAndTime(this.formatWeekdays(weekdays), this.formatTimes(times)) + TimetableFormatter.maybeAppendComment(comment);
        })
    }

    private static maybeAppendComment(comment?: string): string {
        return comment ? ` (${comment})` : ''
    }

    private formatDatesExact(datesExact: DateExact[]): FormattedTimetable['datesExact'] {
        const isoDate = formatISO(this.now, {representation: 'date'})
        const isoTime = format(this.now, 'HH:mm')
        return datesExact
            .filter((dateTimes) =>
                this.config.hidePast === undefined || !this.config.hidePast || hasDateTimeInFuture(dateTimes, isoDate, isoTime)
            )
            .map(({date, times, comment}) => {
                return {
                    date: this.formatDateOrDateRange(date),
                    times: this.formatTimes(times),
                    comment
                }
            })
    }

    private formatDateOrDateRange(dateRange: DateOrDateRange): string {
        if (isSingleDate(dateRange)) {
            const parsedDate = parseISO(dateRange)
            if (this.isFarDate(parsedDate)) {
                return ruFormat(parsedDate, 'dd MMMM yyyy')
            } else {
                return ruFormat(parsedDate, 'dd MMMM')
            }
        } else {
            const from = parseISO(dateRange[0])
            const to = parseISO(dateRange[1])

            if (this.config.hidePast && isAfter(this.now, from)) {
                if (this.isFarDate(to)) {
                    return `до ${ruFormat(to, 'dd MMMM yyyy')}`
                } else {
                    return `до ${ruFormat(to, 'dd MMMM')}`
                }
            } else {

                if (this.isFarDate(from) || this.isFarDate(to)) {
                    return `${ruFormat(from, 'dd MMMM yyyy')} - ${ruFormat(to, 'dd MMMM yyyy')}`
                } else if (getMonth(from) != getMonth(to)) {
                    return `${ruFormat(from, 'dd MMMM')} - ${ruFormat(to, 'dd MMMM')}`
                } else {
                    return `${ruFormat(from, 'dd')}-${ruFormat(to, 'dd MMMM')}`
                }
            }
        }
    }

    private isFarDate(parsedDate: Date) {
        return Math.abs(differenceInDays(parsedDate, this.now)) > this.DAYS_DIFF_TO_PRINT_YEAR
    }
}