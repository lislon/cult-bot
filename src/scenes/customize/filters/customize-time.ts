import { ContextMessageUpdate } from '../../../interfaces/app-interfaces'
import { DropdownMenu } from '../dropdown-menu'
import { addDays, format } from 'date-fns/fp'
import { getISODay, startOfISOWeek } from 'date-fns'
import { InlineKeyboardButton } from 'telegraf/typings/telegram-types'
import { getNextWeekendRangeForCustom } from '../customize-common'
import { i18n } from '../../../util/i18n'
import { filterPastIntervals } from '../format-explain'

export async function getKeyboardTime(ctx: ContextMessageUpdate) {
    const menu = new DropdownMenu(ctx, ctx.session.customize.time, ctx.session.customize.openedMenus, 'time_section')
    const weekdays = [0, 1]
        .map(i => addDays(i)(getNextWeekendRangeForCustom(startOfISOWeek(ctx.now())).start))
        .map(d => format('dd.MM', d))

    let buttons: InlineKeyboardButton[][] = []
    if (getISODay(ctx.now()) <= 6) {
        const sat = menu.dropDownButtons('menu_saturday', generateDropdownTimes('saturday', ctx.now()), {date: weekdays[0]})
        buttons = [...buttons, ...sat]
    }
    if (getISODay(ctx.now()) <= 7) {
        const sun = menu.dropDownButtons('menu_sunday', generateDropdownTimes('sunday', ctx.now()), {date: weekdays[1]})
        buttons = [...buttons, ...sun]
    }

    return buttons
}

export function timeOptionLogic(ctx: ContextMessageUpdate, selected: string) {
    if (ctx.session.customize.time.includes(selected)) {
        ctx.session.customize.time = ctx.session.customize.time.filter(s => s !== selected)
    } else {
        ctx.session.customize.time.push(selected)
    }
}

/**
 * generates a times like [
 * ['sunday.00:00-06:00'],
 * ['sunday.06:00-12:00']
 * ]
 */
function generateDropdownTimes(weekday: 'saturday' | 'sunday', now: Date) {
    function getIntervalsFromI18N(day: string) {
        return i18n.resourceKeys('ru')
            .filter(key => key.startsWith(`scenes.customize_scene.keyboard.time_section.${day}.`))
            .map(key => [key.replace(/^.+[.](?=[^.]+$)/, '')])
    }

    const isoDate = weekday == 'saturday' ? 6 : 7
    return filterPastIntervals(
        getIntervalsFromI18N(weekday).map(i => i[0]),
        getISODay(now) === isoDate ? now : undefined
    ).map(i => [i])
}