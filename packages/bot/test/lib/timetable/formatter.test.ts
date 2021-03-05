import {
    DateExact,
    DateOrDateRange,
    DateRangeTimetable,
    DayTime,
    EventTimetable,
    WeekTime
} from '../../../src/lib/timetable/intervals'
import { parseTimetable } from '../../../src/lib/timetable/parser'
import { date } from './test-utils'
import { addDays, differenceInDays, getMonth, parseISO } from 'date-fns'
import { ruFormat } from '../../../src/scenes/shared/shared-logic'

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
    }[]
    anytime?: string
}

interface TimetableConfig {
    hidePast?: boolean
}

class TimetableFormatter {

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
            ruFormat(addDays(this.FIXED_MONDAY, dayInWeek), 'eeeeee');

        let from = -1;
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
        const strWeekTimes = weekTimes.join('\n')
        const strDatesExact = datesExact.map(({date, times}) => `${date}: ${times}`).join('\n')
        const strDateRangesTimetable = dateRangesTimetable
            .map(({dateRange, times, weekTimes}) => {
                return `${dateRange}: ${times ?? weekTimes.join(', ')}`
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
                    times: this.formatTimes(times)
                }
            }
        )
    }

    private formatWeekTimes(weekTimes?: WeekTime[]): FormattedTimetable['weekTimes'] {
        return weekTimes?.map(({weekdays, times}) => {
            return `${this.formatWeekdays(weekdays)}: ${this.formatTimes(times)}`
        })
    }

    private formatDatesExact(datesExact?: DateExact[]): FormattedTimetable['datesExact'] {
        return datesExact?.filter(({dateRange}) =>
            this.filterOnlyFuture(dateRange)
        )
            .map(({dateRange, times}) => {
                return {
                    date: this.formatDateOrDateRange(dateRange),
                    times: this.formatTimes(times)
                }
            })
    }

    private filterOnlyFuture(dateRange: DateOrDateRange) {
        if (dateRange.length === 1 && this.config.hidePast) {
            const parsedDate = parseISO(dateRange[0]);
            if (parsedDate < this.now) {
                return false
            }
        }
        return true
    }

    private formatDateOrDateRange(dateRange: DateOrDateRange): string {
        if (dateRange.length === 1) {
            const parsedDate = parseISO(dateRange[0]);
            if (this.isFarDate(parsedDate)) {
                return ruFormat(parsedDate, 'dd MMMM yyyy')
            } else {
                return ruFormat(parsedDate, 'dd MMMM')
            }
        } else {
            const from = parseISO(dateRange[0]);
            const to = parseISO(dateRange[1]);
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
        return Math.abs(differenceInDays(parsedDate, this.now)) > this.DAYS_DIFF_TO_PRINT_YEAR;
    }
}

const NOW = date('2020-01-01 15:00')

function expectWillBeFormatted(expected: string, text: string = expected, now: Date = NOW, config: TimetableConfig = {}): void {
    let timetable = parseTimetable(text, now);
    if (timetable.status === true) {
        const result = new TimetableFormatter(now, config).formatTimetable(timetable.value)
        expect(result).toEqual(expected)
    } else {
        fail('failed to parse: ' + text + '\n' + timetable.errors.join('\n'))
    }
}

describe('timetable formatter', () => {

    test('anytime', () => {
        let input = `в любое время`;
        const expected = 'В любое время'
        expectWillBeFormatted(expected, input);
    })

    test('time_multiply_with_range', () => {
        expectWillBeFormatted(`сб: 10:00-12:00,14:00`);
    })

    test('week_regular_single', () => {
        expectWillBeFormatted('сб: 10:00');
    })

    test('week_regular_range', () => {
        expectWillBeFormatted('пн,сб-вс: 10:00');
    })

    test('concrete_dates_single_far', () => {
        let input = `12 января 2020: 10:00`;
        const expected = '12 января 2020: 10:00'
        expectWillBeFormatted(expected, input, new Date(2000, 1, 1));
    })

    test('concrete_dates_single_short', () => {
        let input = `12 января 2020: 10:00`;
        const expected = '12 января: 10:00'
        expectWillBeFormatted(expected, input);
    })

    test('concrete_dates_dual_short', () => {
        let input = `12 января 2020: 10:00; 13 января 2020: 10:00`;
        const expected = '12 января: 10:00\n13 января: 10:00'
        expectWillBeFormatted(expected, input);
    })

    test('concrete_dates_range_far', () => {
        expectWillBeFormatted('12 января 2020 - 12 января 2030: 10:00');
    })

    test('concrete_dates_range_short_diff_months', () => {
        expectWillBeFormatted(`28 января - 01 февраля: 10:00`);
    })

    test('concrete_dates_range_short_same_months', () => {
        let input = `25 января 2020 - 28 января 2020: 10:00`;
        let expected = `25-28 января: 10:00`;
        expectWillBeFormatted(expected, input);
    })

    test('week_regular + concrete_dates_single_short', () => {
        let expected = `сб: 10:00\n12 января: 10:00`;
        expectWillBeFormatted(expected);
    })

    test('week_range_every_day', () => {
        let input = `25 января 2020 - 28 января 2020: в любое время`;
        let expected = `25-28 января: 00:00-24:00`;
        expectWillBeFormatted(expected, input);
    })

    test('concrete_dates_hide_past', () => {
        let input = `12 декабря 2019: 10:00\n12 января 2020: 10:00`;
        const expected = '12 января: 10:00'
        expectWillBeFormatted(expected, input, NOW, {hidePast: true});
    })
})
