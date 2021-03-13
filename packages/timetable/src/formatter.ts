import { DayTime } from './intervals'
import { ruFormat } from './ruFormat'
import { addDays, differenceInDays, getMonth, parseISO } from 'date-fns'
import { DateExact, DateOrDateRange, DateRangeTimetable, EventTimetable, isSingleDate, WeekTime } from './interfaces'

export interface FormattedTimetable {
    weekTimes?: string[]
    dateRangesTimetable?: {
        dateRange: string
        weekTimes?: string[]
        times?: string
    }[]
    datesExact?: {
        date: string
        times?: string
        comment?: string
    }[]
    anytime?: string
}

export interface TimetableConfig {
    hidePast?: boolean
}

export class TimetableFormatter {

    private FIXED_MONDAY = new Date(2021, 1, 7)
    private DAYS_DIFF_TO_PRINT_YEAR = 180

    constructor(private now: Date, private config: TimetableConfig = {}) {

    }

    formatTimes(times: DayTime[]): string {
        return times.map(time => {
            if (Array.isArray(time)) {
                return `${time[0]}-${time[1]}`
            } else {
                return time
            }
        }).join(',')
    }

    formatWeekdays(weekdays: number[]): string {
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

    formatTimetable(timetable: EventTimetable): string {
        const {anytime, datesExact, dateRangesTimetable, weekTimes} = this.structureFormatTimetable(timetable)
        if (anytime) {
            return anytime
        }
        const strWeekTimes = weekTimes?.join('\n')
        const strDatesExact = datesExact
            ?.map(({date, times, comment}) =>
                `${date}: ${times}${this.maybeAppendComment(comment)}`
            )
            .join('\n')
        const strDateRangesTimetable =
            dateRangesTimetable
                ?.map(({dateRange, times, weekTimes}) => {
                    return `${dateRange}: ${times ?? (weekTimes ? weekTimes.join(', ') : '')}`
                })
                .join('\n')
        return [strWeekTimes, strDatesExact, strDateRangesTimetable]
            .filter(s => s !== undefined && s !== '')
            .join('\n')
    }

    structureFormatTimetable(timetable: EventTimetable): FormattedTimetable {
        const {anytime, datesExact, dateRangesTimetable, weekTimes} = timetable
        if (anytime) {
            return {anytime: 'В любое время'}
        }
        return {
            weekTimes: this.formatWeekTimes(weekTimes),
            datesExact: this.formatDatesExact(datesExact),
            dateRangesTimetable: this.formatDateRangesTimetable(dateRangesTimetable)
        }
    }

    formatDateRangesTimetable(dateRangesTimetable?: DateRangeTimetable[]): FormattedTimetable['dateRangesTimetable'] {
        return dateRangesTimetable?.map(({dateRange, weekTimes, times}) => {
                return {
                    dateRange: this.formatDateOrDateRange(dateRange),
                    weekTimes: this.formatWeekTimes(weekTimes),
                    times: times ? this.formatTimes(times) : undefined
                }
            }
        )
    }

    private formatWeekTimes(weekTimes?: WeekTime[]): FormattedTimetable['weekTimes'] {
        return weekTimes?.map(({weekdays, times, comment}) => {
            return `${this.formatWeekdays(weekdays)}: ${this.formatTimes(times)}${this.maybeAppendComment(comment)}`
        })
    }

    private maybeAppendComment(comment?: string): string {
        return comment ? ` (${comment})` : ''
    }

    private formatDatesExact(datesExact?: DateExact[]): FormattedTimetable['datesExact'] {
        return datesExact?.filter(({date}) =>
            this.filterOnlyFuture(date)
        )
            .map(({date, times, comment}) => {
                return {
                    date: this.formatDateOrDateRange(date),
                    times: this.formatTimes(times),
                    comment
                }
            })
    }

    private filterOnlyFuture(date: string) {
        if (this.config.hidePast) {
            const parsedDate = parseISO(date)
            if (parsedDate < this.now) {
                return false
            }
        }
        return true
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
            if (this.isFarDate(from) || this.isFarDate(to)) {
                return `${ruFormat(from, 'dd MMMM yyyy')} - ${ruFormat(to, 'dd MMMM yyyy')}`
            } else if (getMonth(from) != getMonth(to)) {
                return `${ruFormat(from, 'dd MMMM')} - ${ruFormat(to, 'dd MMMM')}`
            } else {
                return `${ruFormat(from, 'dd')}-${ruFormat(to, 'dd MMMM')}`
            }
        }
    }

    private isFarDate(parsedDate: Date) {
        return Math.abs(differenceInDays(parsedDate, this.now)) > this.DAYS_DIFF_TO_PRINT_YEAR
    }
}