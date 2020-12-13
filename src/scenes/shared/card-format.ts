import { escapeHTML } from '../../util/string-utils'
import { Event } from '../../interfaces/app-interfaces'
import { getOnlyHumanTimetable } from '../../dbsync/parseSheetRow'
import { cleanTagLevel1 } from '../../util/tag-level1-encoder'
import { fieldIsQuestionMarkOrEmpty } from '../../util/filed-utils'
import { i18n } from '../../util/i18n'
import { EventWithOldVersion } from '../../database/db-admin'
import { getCurEventIndex, getEventsCount } from '../packs/packs-common'

function addHtmlNiceUrls(text: string) {
    return text.replace(/\[(.+?)\]\s*\(([^)]+)\)/g, '<a href="$2">$1</a>')
}

export function escapeWithPrice(text: string) {
    return text.replace(/\s*(руб|рублей|р\.|руб\.)(\s|$|,)/g, ' ₽$2')
}

function formatUrl(text: string) {
    const niceUrls = addHtmlNiceUrls(text)
    if (niceUrls === text && text.match(/^https?:\/\//)) {
        return `<a href="${text}">(ссылка на событие)</a>`
    }
    return niceUrls
}

function formatTimetable(event: Event) {
    const humanTimetable = getOnlyHumanTimetable(event.timetable);

    function formatCinimaUrls(humanTimetable: string) {
        const lines = humanTimetable.split(/[\n\r]+/)
        return lines
            .map(l => l.trim())
            .map(l => l.replace(/:[^(]*[(](http.+?)[)]/, ': <a href="$1">расписание</a>'))
            .map(l => l.replace(/ 202\d/, ''))
            .map(l => `🗓 ${l}\n`)
            .join('')
    }

    function cutYear(humanTimetable: string) {
        return humanTimetable.replace(/^\d+ [а-яА-Я]+(\s+\d+)?\s*-\s*/g, 'до ')
    }

    return formatCinimaUrls(cutYear(humanTimetable))
}

function getWhereEmoji(row: Event) {
    return i18n.t(`ru`, `shared.category_icons.${row.category}`)
}

export interface CardOptions {
    showAdminInfo: boolean
    packs?: boolean
}

export function cardFormat(row: Event|EventWithOldVersion, options: CardOptions = { showAdminInfo: false }) {
    let text = ``;
    const rowWithOldVersion = row as EventWithOldVersion
    if (rowWithOldVersion.snapshotStatus !== undefined) {
        if (rowWithOldVersion.snapshotStatus === 'inserted') {
            text += '<b>[NEW]</b> '
        } else if (rowWithOldVersion.snapshotStatus === 'updated') {
            text += '<b>[MOD]</b> '
        } else {
            text += '[OLD] '
        }
    }

    // if (options.packs) {
    //     text += `<b>${addHtmlNiceUrls(escapeHTML(row.title))}</b>`
    //     text += '\n'
    //     text += '\n'
    //     text += `<b>${escapeHTML(row.tag_level_1.map(t => cleanTagLevel1(t)).join(' '))}</b>`
    // } else {
    //
    // }
    text += `<b>${escapeHTML(row.tag_level_1.map(t => cleanTagLevel1(t)).join(' '))}</b>`
    text += '\n'
    text += '\n'
    text += `<b>${addHtmlNiceUrls(escapeHTML(row.title))}</b>`

    text += '\n'
    text += '\n'
    text += `${addHtmlNiceUrls(escapeHTML(row.description))} \n`
    text += '\n'

    if (!fieldIsQuestionMarkOrEmpty(row.place)) {
        text += `${getWhereEmoji(row)} ${addHtmlNiceUrls(escapeHTML(row.place))}\n`
    }
    const map = row.geotag != '' ? ` <a href="${escapeHTML(row.geotag)}">(Я.Карта)</a>` : ``
    if (!fieldIsQuestionMarkOrEmpty(row.address)) {
        text += `📍 ${addHtmlNiceUrls(escapeHTML(row.address))}${map}\n`
    }
    text += formatTimetable(row)
    if (!fieldIsQuestionMarkOrEmpty(row.duration)) {
        text += `🕐 ${escapeHTML(row.duration)}\n`
    }
    if (!fieldIsQuestionMarkOrEmpty(row.price)) {
        text += `💳 ${addHtmlNiceUrls(escapeHTML(escapeWithPrice(row.price)))}\n`
    }
    if (!fieldIsQuestionMarkOrEmpty(row.notes)) {
        text += `<b>Особенности:</b>  ${addHtmlNiceUrls(escapeHTML(row.notes))}\n`
    }
    if (!fieldIsQuestionMarkOrEmpty(row.url)) {
        text += `${formatUrl(escapeHTML(row.url))}\n`
    }
    text += '\n'
    text += `${escapeHTML([...row.tag_level_3, ...row.tag_level_2].join(' '))}\n`
    if (options.showAdminInfo) {
        text += `<i>${row.ext_id}, ${row.reviewer}, оценка ${row.rating}</i>\n`
    }

    return text;
}
