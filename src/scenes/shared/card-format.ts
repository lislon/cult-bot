import { escapeHTML } from '../../util/string-utils'
import { Event } from '../../interfaces/app-interfaces'
import { getOnlyHumanTimetable } from '../../dbsync/parseSheetRow'
import { cleanTagLevel1 } from '../../util/tag-level1-encoder'
import { fieldIsQuestionMarkOrEmpty } from '../../util/filed-utils'

function addHtmlNiceUrls(text: string) {
    return text.replace(/\[(.+?)\]\s*\(([^)]+)\)/g, '<a href="$2">$1</a>')
}

function escapeWithPrice(text: string) {
    return text.replace(/\s*(руб|рублей|р\.|руб\.)(\s|$)/g, ' ₽')
}

function formatUrl(text: string) {
    const niceUrls = addHtmlNiceUrls(text)
    if (niceUrls === text && text.match(/^https?:\/\//)) {
        return `<a href="${text}">(ссылка на событие)</a>`
    }
    return niceUrls
}

export function cardFormat(row: Event) {
    let text = ``;
    text += `<b>${escapeHTML(row.tag_level_1.map(t => cleanTagLevel1(t)).join(' '))}</b>\n`
    text += '\n'
    text += `<b>${addHtmlNiceUrls(escapeHTML(row.title))}</b>\n`
    text += '\n'
    text += `${addHtmlNiceUrls(escapeHTML(row.description))} \n`
    text += '\n'

    if (!fieldIsQuestionMarkOrEmpty(row.place)) {
        text += `<b>Где:</b> ${addHtmlNiceUrls(escapeHTML(row.place))}\n`
    }
    const map = row.geotag != '' ? ` <a href="${escapeHTML(row.geotag)}">(Я.Карта)</a>` : ``
    if (!fieldIsQuestionMarkOrEmpty(row.address)) {
        text += `📍 ${addHtmlNiceUrls(escapeHTML(row.address))}${map}\n`
    }
    text += `🗓 ${getOnlyHumanTimetable(row.timetable)}\n`
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
    text += `${escapeHTML(row.tag_level_3.join(' '))}\n`

    return text;
}
