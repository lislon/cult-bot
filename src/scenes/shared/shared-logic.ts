import { Moment } from 'moment'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import dbsync from '../../dbsync/dbsync'
import { WrongExcelColumnsError } from '../../dbsync/WrongFormatException'
import moment = require('moment')

export function getNextWeekEndRange(): [Moment, Moment] {
    const now = moment().tz('Europe/Moscow')
    const weekendStarts = moment().tz('Europe/Moscow')
        .startOf('week')
        .add(6, 'd')
    const weekendEnds = moment().tz('Europe/Moscow')
        .startOf('week')
        .add(8, 'd')
        .subtract(2, 'hour')

    return [moment.max(now, weekendStarts), weekendEnds]
}

export async function syncrhonizeDbByUser(ctx: ContextMessageUpdate) {
    await ctx.replyWithHTML(`Пошла скачивать <a href="${getGoogleSpreadSheetURL()}">эксельчик</a>...`, {
        disable_web_page_preview: true
    })
    try {
        const {updated, errors} = await dbsync()
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