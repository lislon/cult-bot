import { ContextMessageUpdate, MyInterval } from '../../interfaces/app-interfaces'
import dbsync from '../../dbsync/dbsync'
import { WrongExcelColumnsError } from '../../dbsync/WrongFormatException'
import { db } from '../../db'
import { addDays, max, parseISO, startOfDay, startOfISOWeek } from 'date-fns/fp'
import { format, formatDistanceToNow, Locale } from 'date-fns'
import flow from 'lodash/fp/flow'
import { ru } from 'date-fns/locale'
import { i18n } from '../../util/i18n'
import { botConfig } from '../../util/bot-config'
import { STICKER_CAT_THUMBS_UP } from '../../util/stickers'

export function getNextWeekEndRange(now: Date): MyInterval {
    return {
        start: max([now, (flow(startOfISOWeek, startOfDay, addDays(5))(now))]),
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

export async function syncrhonizeDbByUser(ctx: ContextMessageUpdate) {
    await ctx.replyWithHTML(`Пошла скачивать <a href="${getGoogleSpreadSheetURL()}">эксельчик</a>...`, {
        disable_web_page_preview: true
    })
    try {
        const {updated, errors} = await dbsync(db)
        await ctx.replyWithHTML(ctx.i18n.t('sync.sync_success', {updated, errors}))

        if (errors === 0) {
            await ctx.replyWithSticker(STICKER_CAT_THUMBS_UP)
        }
    } catch (e) {
        if (e instanceof WrongExcelColumnsError) {
            await ctx.reply(ctx.i18n.t('sync.wrong_format', e.data))
        } else {
            await ctx.reply(`❌ Эх, что-то не удалось :(...` + e.toString().substr(0, 100))
        }
    }
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

    static number(original: number): number {
        return typeof original === 'number' ? original : undefined;
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