import { differenceInHours, format, formatISO, getISODay } from 'date-fns'
import { WeekTime, DateExact, TimetableFormatter } from '@culthub/timetable'
import { uniq } from 'lodash'

function getDatesExact(dates: Date[]): DateExact[] {
    return dates.map(d => ({
        date: formatISO(d, {representation: 'date'}),
        times: [format(d, 'HH:mm')]
    }))
}

function getWeekTimes(weekdaysTimes: string[]): WeekTime[] {
    return uniq(weekdaysTimes)
        .filter(time => time !== '')
        .map(time => {

        const weekdays: number[] = []
        for (let i = 1; i <= 7; i++) {
            if (weekdaysTimes[i] === time) {
                weekdays.push(i)
            }
        }

        return {
            weekdays,
            times: [time]
        }
    })
}

const MIN_TIMES_ON_SAME_WEEKDAY_FOR_WEEK_TIMETABLE = 3

export function datesToTimetable(dates: Date[]): string {
    if (dates.length === 0) {
        return ''
    }
    const formatter = new TimetableFormatter(dates[0], {})

    const weekdaysFreq: number[] = [-1, 0, 0, 0, 0, 0, 0, 0]
    const weekdaysTimes = ['', '', '', '', '', '', '', '']
    let hasDifferentTimeOnSomeDay = false
    let isContinuous = dates.length > 1
    let prevDate: Date|undefined = undefined
    let prevDiff: number|undefined = undefined
    dates.forEach(d => {
        const isoDay = getISODay(d)
        const time = format(d, 'HH:mm')
        if (weekdaysTimes[isoDay] === '') {
            weekdaysTimes[isoDay] = time
            weekdaysFreq[isoDay]++
        } else if (weekdaysTimes[isoDay] === time) {
            weekdaysFreq[isoDay]++
        } else {
            hasDifferentTimeOnSomeDay = true
        }
        if (prevDate !== undefined && prevDiff !== undefined && prevDiff !== differenceInHours(prevDate, d)) {
            isContinuous = false;
        }
        if (prevDate !== undefined) {
            prevDiff = differenceInHours(prevDate, d)
        }
        prevDate = d;
    })

    if (isContinuous && !hasDifferentTimeOnSomeDay) {
        return formatter.formatTimetable({
            dateRangesTimetable: [
                {
                    dateRange: [format(dates[0], 'yyyy-MM-dd'), format(dates[dates.length - 1], 'yyyy-MM-dd')],
                    times: [format(dates[0], 'HH:mm')]
                }
            ]
        })
    } else if (!hasDifferentTimeOnSomeDay && Math.max(...weekdaysFreq) >= MIN_TIMES_ON_SAME_WEEKDAY_FOR_WEEK_TIMETABLE) {
        const weekTimes = getWeekTimes(weekdaysTimes)

        return formatter.formatTimetable({
            dateRangesTimetable: [
                {
                    dateRange: [format(dates[0], 'yyyy-MM-dd'), format(dates[dates.length - 1], 'yyyy-MM-dd')],
                    weekTimes
                }
            ]
        })
    }
    return formatter.formatTimetable({
        datesExact: getDatesExact(dates)
    })
}