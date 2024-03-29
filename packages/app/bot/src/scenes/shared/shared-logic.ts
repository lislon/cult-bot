import { ContextCallbackQueryUpdate, ContextMessageUpdate, DateInterval } from '../../interfaces/app-interfaces'
import { addDays, max, parseISO, startOfDay, startOfISOWeek } from 'date-fns/fp'
import { format, formatDistanceToNow, isAfter, isBefore, Locale, parse } from 'date-fns'
import flow from 'lodash/fp/flow'
import { ru } from 'date-fns/locale'
import { i18n } from '../../util/i18n'
import { botConfig, MAX_TELEGRAM_MESSAGE_LENGTH } from '../../util/bot-config'
import plural from 'plural-ru'
import { Markup } from 'telegraf'
import slugify from 'slugify'
import { i18SharedBtn, i18SharedMsg } from '../../util/scene-helper'
import { chunkString } from '../../util/chunk-split'
import { InlineKeyboardButton, InlineKeyboardMarkup, Message } from 'typegram'
import { SLOT_DATE_FORMAT } from '../customize/customize-common'
import { isAfterOrEquals } from '../../util/moment-msk'
import { first, last } from 'lodash'
import { leftDate, MomentIntervals, rightDate } from '@culthub/timetable'
import { ExtraReplyMessage } from 'telegraf/typings/telegram-types'

type Range = '2weekends_only'

export function getNextWeekendRange(now: Date, range?: Range): DateInterval {

    // 2weekends_only is used by customize filter. It has it own logic working with configured holidays
    // if (range !== '2weekends_only') {
    const holidays = getConfiguredHolidaysIfAny(now)

    if (holidays.length > 0) {
        return {
            start: max([now, holidays[0]]),
            end: startOfDay(addDays(1, holidays[holidays.length - 1]))
        }
    }
    // }

    return {
        start: max([now, (flow(startOfISOWeek, startOfDay, addDays(5))(now))]),
        end: flow(startOfISOWeek, startOfDay, addDays(7))(now)
    }
}

export function getNextWeekRange(now: Date): DateInterval {
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

export function ruFormat(date: Date | number, pattern: string): string {
    return format(date, pattern, ruDateFormat)
}

export function getGoogleSpreadSheetURL(): string {
    return `https://docs.google.com/spreadsheets/d/${botConfig.GOOGLE_DOCS_ID}`
}

export class SessionEnforcer {
    static array<T>(any: any): T[] {
        return Array.isArray(any) ? any : []
    }

    static default<T>(original: T, def: T): T {
        return (original === undefined) ? def : original
    }

    static number(original: number, defaultValue?: number): number | undefined {
        return typeof original === 'number' ? original : defaultValue
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
        reply_markup: Markup.inlineKeyboard(rows).reply_markup
    }
}

type UpdateBtnFunc = (text: InlineKeyboardButton.CallbackButton) => (InlineKeyboardButton.CallbackButton | InlineKeyboardButton.CallbackButton[])

export async function updateKeyboardButtons(replyMarkup: undefined,
                                            callbackDataToken: RegExp,
                                            updateFunc: UpdateBtnFunc): Promise<undefined>;
export async function updateKeyboardButtons(replyMarkup: InlineKeyboardMarkup,
                                            callbackDataToken: RegExp,
                                            updateFunc: UpdateBtnFunc): Promise<InlineKeyboardMarkup>;
export async function updateKeyboardButtons(replyMarkup: InlineKeyboardMarkup | undefined,
                                            callbackDataToken: RegExp,
                                            updateFunc: UpdateBtnFunc): Promise<InlineKeyboardMarkup | undefined> {
    if (replyMarkup !== undefined) {
        const newKeyboard: InlineKeyboardButton.CallbackButton[][] = []
        for (const row of replyMarkup.inline_keyboard) {
            const q = row.flatMap((btn: InlineKeyboardButton.CallbackButton) => {
                if (btn.callback_data.match(callbackDataToken)) {
                    const newBtnOrButtons = updateFunc(btn)
                    return Array.isArray(newBtnOrButtons) ? newBtnOrButtons : [newBtnOrButtons]
                }
                return [btn]
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

export function mySlugify(text: string): string {
    return slugify(text, {
        lower: true,
        strict: true
    })
}

// @deprec -> editMessageAndButtons
export function backToMainButtonTitle(): string {
    return i18SharedBtn('markup_back')
}

export async function replyWithBackToMainMarkup(ctx: ContextMessageUpdate, message?: string): Promise<number> {
    const markupWithBackButton = Markup.keyboard([Markup.button.text(backToMainButtonTitle())]).resize()

    const msg = await ctx.replyWithHTML(message ?? i18SharedMsg('markup_back_decoy'), markupWithBackButton)
    return msg.message_id
}

export interface EditMessageAndButtonsOptions {
    forceNewMsg?: boolean
}

export async function editMessageAndButtons(ctx: ContextMessageUpdate, inlineButtons: InlineKeyboardButton[][], text: string, options?: EditMessageAndButtonsOptions): Promise<number> {
    const markup: InlineKeyboardMarkup = {
        inline_keyboard: inlineButtons
    }
    const goodErrors = [
        `Telegraf: "editMessageText" isn't available for "message"`,
        `Telegraf: "editMessageReplyMarkup" isn't available for "message"`,
        '400: Bad Request: message is not modified: specified new message content and reply markup are exactly the same as a current content and reply markup of the message'
    ]
    if (options?.forceNewMsg) {
        const message = await ctx.replyWithHTML(text, {
            reply_markup: markup,
            disable_web_page_preview: !botConfig.SLIDER_INSTA_VIEW
        })
        return message.message_id
    }

    try {

        await ctx.editMessageText(text, {
            parse_mode: 'HTML',
            disable_web_page_preview: !botConfig.SLIDER_INSTA_VIEW,
            reply_markup: markup
        })

        return getMsgId(ctx)
    } catch (e) {
        if (goodErrors.includes(e.message)) {
            ctx.logger.debug(e.message)
            const message = await ctx.replyWithHTML(text, {
                reply_markup: markup,
                disable_web_page_preview: !botConfig.SLIDER_INSTA_VIEW
            })
            return message.message_id
        } else {
            throw e
        }
    }
    // ctx.session.lastText = text
}

export function getMsgId(ctx: ContextMessageUpdate): number | undefined {
    if ('message' in ctx.update) {
        return ctx.update.message.message_id
    } else if ('callback_query' in ctx.update) {
        return ctx.update.callback_query?.message?.message_id
    } else {
        throw new Error('wtf ' + JSON.stringify(ctx.update))
    }
}

export async function buttonIsOldGoToMain(ctx: ContextCallbackQueryUpdate): Promise<void> {
    if ('data' in ctx.update.callback_query) {
        ctx.logger.warn(`@${ctx.from?.username} (id=${ctx.from?.id}): [type=${ctx.updateType}], [callback_data=${ctx.update.callback_query.data}] buttonIsOldGoToMain`)
    }
    await editMessageAndButtons(ctx, [[Markup.button.callback(i18SharedBtn('back'), 'go_to_main')]], ctx.i18n.t('root.unknown_action'))
    await ctx.scene.enter('main_scene', {override_main_scene_msg: ctx.i18n.t('root.unknown_action')})
}

export function getInlineKeyboardFromCallbackQuery(ctx: ContextCallbackQueryUpdate): InlineKeyboardMarkup {
    if ('message' in ctx.update.callback_query && 'reply_markup' in ctx.update.callback_query.message) {
        return ctx.update.callback_query.message.reply_markup
    } else {
        throw new Error('wtf')
    }
}

export async function chunkanize(msg: string, callback: (text: string, extra?: ExtraReplyMessage) => Promise<Message>, extra: ExtraReplyMessage = undefined, maxLen: number = MAX_TELEGRAM_MESSAGE_LENGTH): Promise<Message> {
    const chunks: string[] = chunkString(msg, maxLen)
    let last: Message = undefined
    for (let i = 0; i < chunks.length; i++) {
        last = await callback(chunks[i], i === chunks.length - 1 ? extra : {...extra, disable_notification: true})
    }
    return last
}

export function getConfiguredHolidaysIfAny(now: Date): Date[] {
    return botConfig.HOLIDAYS === '' ? [] : botConfig.HOLIDAYS
        .split(/\s*,\s*/)
        .map(str => parse(str.trim(), SLOT_DATE_FORMAT, new Date()))
        .filter(holidayDate => isAfterOrEquals(holidayDate, startOfDay(now)))
}

export function isEventEndsInFuture(timeIntervals: MomentIntervals, date: Date): boolean {
    return timeIntervals.length > 0 && isAfter(rightDate(last(timeIntervals)), date)
}

export function isEventStarsInPast(timeIntervals: MomentIntervals, date: Date): boolean {
    return timeIntervals.length > 0 && isBefore(leftDate(first(timeIntervals)), date)
}