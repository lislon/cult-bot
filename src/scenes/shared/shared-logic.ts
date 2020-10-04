import { Moment } from 'moment'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import dbsync from '../../dbsync/dbsync'
import { WrongExcelColumnsError } from '../../dbsync/WrongFormatException'
import moment = require('moment')
import { db } from '../../db'
import { mskMoment } from '../../util/moment-msk'

export function getNextWeekEndRange(): [Moment, Moment] {
    const now = moment().tz('Europe/Moscow')
    const weekendStarts = mskMoment()
        .startOf('week')
        .add(6, 'd')
    const weekendEnds = mskMoment()
        .startOf('week')
        .add(8, 'd')

    return [moment.max(now, weekendStarts), weekendEnds]
}

export async function syncrhonizeDbByUser(ctx: ContextMessageUpdate) {
    await ctx.replyWithHTML(`Пошла скачивать <a href="${getGoogleSpreadSheetURL()}">эксельчик</a>...`, {
        disable_web_page_preview: true
    })
    try {
        const {updated, errors} = await dbsync(db)
        await ctx.replyWithHTML(ctx.i18n.t('sync.sync_success', {updated, errors}))
    } catch (e) {
        if (e instanceof WrongExcelColumnsError) {
            await ctx.reply(ctx.i18n.t('sync.wrong_format', e.data))
        } else {
            await ctx.reply(`❌ Эх, что-то не удалось :(...` + e.toString().substr(0, 100))
        }
    }
}

export function getGoogleSpreadSheetURL() {
    return `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_DOCS_ID}`
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
        ['Release', process.env.HEROKU_RELEASE_VERSION || 'localhost'],
        ['Commit', process.env.HEROKU_SLUG_COMMIT || 'localhost'],
        ['Date', `${process.env.HEROKU_RELEASE_CREATED_AT} (${moment(process.env.HEROKU_RELEASE_CREATED_AT).fromNow()})`],
    ]
    await ctx.replyWithHTML(info.map(row => `<b>${row[0]}</b>: ${row[1]}`).join('\n'))
}