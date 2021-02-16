import { ContextMessageUpdate, I18MsgFunction } from '../../../interfaces/app-interfaces'
import { DropdownMenu } from '../dropdown-menu'
import { addDays } from 'date-fns/fp'
import { endOfDay, isAfter, isBefore, isEqual, parse, startOfDay, startOfISOWeek } from 'date-fns'
import { getNextWeekendRangeForCustom } from '../customize-common'
import { i18n } from '../../../util/i18n'
import { botConfig } from '../../../util/bot-config'
import { ruFormat } from '../../shared/shared-logic'
import { capitalize, groupBy } from 'lodash'

function isAfterOrEquals(holidayDate: Date, dateToCompare: Date) {
    return !isBefore(holidayDate, dateToCompare)
}

const SLOT_DATE_FORMAT = 'yyyy-MM-dd'
const DATE_FORMAT = 'dd.MM'
const WEEKDAY_NAME_FORMAT = 'eeeeee'

export async function getKeyboardTime(ctx: ContextMessageUpdate) {
    const menu = new DropdownMenu(ctx, ctx.session.customize.time, ctx.session.customize.openedMenus, 'time_section')
    let filterDates = [0, 1]
        .map(i => addDays(i)(getNextWeekendRangeForCustom(startOfISOWeek(ctx.now())).start))

    const holidaysOverride = botConfig.HOLIDAYS === '' ? [] : botConfig.HOLIDAYS
        .split(/\s*,\s*/)
        .map(str => parse(str.trim(), SLOT_DATE_FORMAT, new Date()))
        .filter(holidayDate => isAfterOrEquals(holidayDate, startOfDay(ctx.now())))
    if (holidaysOverride.length > 0) {
        // a
        filterDates = holidaysOverride
    }

    const buttons = filterDates
        .filter(filterDate => isAfter(endOfDay(filterDate), ctx.now()))
        .flatMap(filterDate => {
            const btns = menu.dropDownButtons(`menu_date_title`, generateDropdownTimes(filterDate, ctx.now()), {
                weekDay: capitalize(ruFormat(filterDate, 'EEEE')),
                date: ruFormat(filterDate, 'dd.MM')
            }, `menu_${ruFormat(filterDate, SLOT_DATE_FORMAT)}`)
            return btns
        })

    return buttons
}

export function timeOptionLogic(ctx: ContextMessageUpdate, selected: string): void {
    if (ctx.session.customize.time.includes(selected)) {
        ctx.session.customize.time = ctx.session.customize.time.filter(s => s !== selected)
    } else {
        ctx.session.customize.time.push(selected)
    }
}

function joinTimeIntervals(time: string[]) {
    function formatTime(from: number) {
        return ('0' + from).slice(-2) + '.00'
    }

    return time
        .sort()
        .map(t => parseSlot(t))
        .map(({startTime, endTime}) => [+startTime.replace(/:.+/, ''), +endTime.replace(/:.+/, '')])
        .reduceRight((acc: number[][], [from, to]) => {
            if (acc.length > 0 && to === acc[0][0]) {
                acc[0][0] = from
            } else {
                acc = [[from, to], ...acc]
            }
            return acc
        }, [])
        .map(([from, to]) => [from, to === 0 ? 24 : to])
        .map(([from, to]) => `${(formatTime(from))}-${formatTime(to)}`)
}


export function formatExplainTime(ctx: ContextMessageUpdate, i18Msg: I18MsgFunction): string[] {
    const timeSlots = ctx.session.customize.time
    if (timeSlots.length === 0) {
        return []
    }
    const now = ctx.now()
    const filteredSlots = filterPastIntervals(timeSlots, now)
        .sort()

    const groupedByDates = Object.entries(groupBy(filteredSlots, slot => slot.substring(0, SLOT_DATE_FORMAT.length)))

    const weekdays = groupedByDates.map(([dateStr, timeslots]) => {
        const joinedTimeSlots = joinTimeIntervals(timeslots)

        const date = parse(dateStr, SLOT_DATE_FORMAT, new Date())

        return i18Msg(ctx, 'explain_filter.time_line', {
            weekday: ruFormat(date, WEEKDAY_NAME_FORMAT).toUpperCase(),
            date: ruFormat(date, DATE_FORMAT),
            timeIntervals: joinedTimeSlots.join(', '),
        })
    })

    if (weekdays.length === 1) {
        return [i18Msg(ctx, 'explain_filter.time') + ' ' + weekdays[0]]
    } else {
        return [
            i18Msg(ctx, 'explain_filter.time'),
            ...weekdays.map(weekdayLine => ' - ' + weekdayLine)
        ]
    }
}

function parseSlot(str: string): { date: Date, startTime: string, endTime: string } {
    const [date, startTime, endTime] = str.split(/\.|-(?=\d\d:\d\d$)/)
    return {date: parse(date, SLOT_DATE_FORMAT, new Date()), startTime, endTime}
}

export function filterPastIntervals(intervals: string[], now: Date | undefined): string[] {
    if (now === undefined) {
        return intervals
    }
    const filtered = intervals
        .filter(str => {
            const {date, endTime} = parseSlot(str)
            if (isAfter(date, startOfDay(now))) {
                return true
            } else if (isEqual(date, startOfDay(now))) {
                return (endTime === '00:00' || endTime > ruFormat(now, 'HH:mm'))
            }
            return false
        })

    return filtered
}

/**
 * generates a times like [
 * ['2012-01-01.00:00-06:00'],
 * ['2012-01-02.06:00-12:00']
 * ]
 */
function generateDropdownTimes(date: Date, now: Date): string[][] {
    const intervals = i18n.resourceKeys('ru')
        .filter(key => key.startsWith(`scenes.customize_scene.keyboard.time_section.date_title.`))
        .map(key => key.replace(/^.+[.](?=[^.]+$)/, ''))
        .map(time => `${ruFormat(date, SLOT_DATE_FORMAT)}.${time}`)

    return filterPastIntervals(
        intervals,
        now
    ).map(i => [i])
}