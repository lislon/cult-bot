import { ContextMessageUpdate, MyInterval } from '../../interfaces/app-interfaces'
import { addDays, max, parseISO, startOfDay, startOfISOWeek } from 'date-fns/fp'
import { format, formatDistanceToNow, isAfter, isBefore, Locale } from 'date-fns'
import flow from 'lodash/fp/flow'
import { ru } from 'date-fns/locale'
import { i18n } from '../../util/i18n'
import { botConfig } from '../../util/bot-config'
import plural from 'plural-ru'
import { Markup } from 'telegraf'
import { ExtraReplyMessage, InlineKeyboardMarkup } from 'telegraf/typings/telegram-types'
import { CallbackButton, InlineKeyboardButton } from 'telegraf/typings/markup'
import slugify from 'slugify'

const YEAR_2020_WEEKENDS = [parseISO('2021-01-01 00:00:00'), parseISO('2021-01-11 00:00:00')]
const START_SHOW_WEEKENDS_FROM = parseISO('2020-12-28 00:00:00')

type Range = '2weekends_only'

export function getNextWeekendRange(now: Date, range: Range = undefined): MyInterval {
    if (range !== '2weekends_only') {
        if (isAfter(now, START_SHOW_WEEKENDS_FROM) && isBefore(now, YEAR_2020_WEEKENDS[1])) {
            return {
                start: max([now, YEAR_2020_WEEKENDS[0]]),
                end: YEAR_2020_WEEKENDS[1]
            }
        }
    }
    return {
        start: max([now, (flow(startOfISOWeek, startOfDay, addDays(5))(now))]),
        end: flow(startOfISOWeek, startOfDay, addDays(7))(now)
    }
}

export function getNextWeekRange(now: Date): MyInterval {
    return {
        start: max([now, (flow(startOfISOWeek, startOfDay, addDays(0))(now))]),
        end: flow(startOfISOWeek, startOfDay, addDays(7))(now)
    }
}

const ruDateFormat: {
    locale?: Locale
    weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6
    firstWeekContainsDate?: number
    useAdditionalWeekYearTokens?: boolean
    useAdditionalDayOfYearTokens?: boolean
} = {
        locale: ru,
        weekStartsOn: 1
    }

export function ruFormat(date: Date | number, pattern: string) {
    return format(date, pattern, ruDateFormat)
}

export function getGoogleSpreadSheetURL() {
    return `https://docs.google.com/spreadsheets/d/${botConfig.GOOGLE_DOCS_ID}`
}

export class SessionEnforcer {
    static array<T>(any: any): T[] {
        return Array.isArray(any) ? any : []
    }

    static default<T>(original: T, def: T): T {
        return (original === undefined) ? def : original;
    }

    static number(original: number, defaultValue: number = undefined): number {
        return typeof original === 'number' ? original : defaultValue;
    }
}
export async function showBotVersion(ctx: ContextMessageUpdate) {
    const info = [
        ['Release', botConfig.HEROKU_RELEASE_VERSION || 'localhost'],
        ['Commit', botConfig.HEROKU_SLUG_COMMIT || 'localhost'],
    ]
    if (botConfig.HEROKU_RELEASE_CREATED_AT) {
        info.push(['Date', `${botConfig.HEROKU_RELEASE_CREATED_AT} (${formatDistanceToNow(parseISO(botConfig.HEROKU_RELEASE_CREATED_AT))})`])
    }
    await ctx.replyWithHTML(info.map(row => `<b>${row[0]}</b>: ${row[1]}`).join('\n'))
}

export const limitEventsToPage = 3

export async function warnAdminIfDateIsOverriden(ctx: ContextMessageUpdate) {
    if (ctx.isNowOverridden()) {
        const msg = i18n.t(`ru`, `shared.date_override_warning`, {time: ruFormat(ctx.now(), 'dd MMMM yyyy HH:mm, iiii')})
        await ctx.replyWithHTML(msg)
    }
}

export function checkboxi18nBtnId(ctx: ContextMessageUpdate, isSelected: boolean): string {
    return ctx.i18n.t(`shared.keyboard.checkbox_${isSelected ? 'on' : 'off'}`)
}

export function generatePlural(ctx: ContextMessageUpdate, word: string, count: number) {
    function t(n: 'one' | 'two' | 'many') {
        return ctx.i18n.t(`shared.plural.${word}.${n}`)
    }

    return plural(count, t('one'), t('two'), t('many'))
}

export function extraInlineMenu(rows: InlineKeyboardButton[][]): ExtraReplyMessage {
    return {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: Markup.inlineKeyboard(rows)
    }
}

export async function parseAndUpdateBtn(replyMarkup: InlineKeyboardMarkup,
                                        callbackDataToken: RegExp, updateFunc: (text: CallbackButton) => (CallbackButton | CallbackButton[])): Promise<undefined | InlineKeyboardMarkup> {
    if (replyMarkup !== undefined) {
        const newKeyboard: CallbackButton[][] = []
        for (const row of replyMarkup.inline_keyboard) {
            const q = row.flatMap((btn: CallbackButton) => {
                if (btn.callback_data.match(callbackDataToken)) {
                    const newBtnOrButtons = updateFunc(btn)
                    return Array.isArray(newBtnOrButtons) ? newBtnOrButtons : [newBtnOrButtons]
                }
                return [btn];
            })
                .filter(btn => btn !== undefined)
            if (q.length > 0) {
                newKeyboard.push(q)
            }
        }
        return {inline_keyboard: newKeyboard}
    }
    return undefined
}

export function mySlugify(text: string) {
    return slugify(text, {
        lower: true,
        strict: true
    })
}

export function getMsgInlineKeyboard(ctx: ContextMessageUpdate) {
    return (ctx.update.callback_query.message as any)?.reply_markup as InlineKeyboardMarkup
}