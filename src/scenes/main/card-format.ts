import { escapeHTML } from '../../util/string-utils'
import { Event } from '../../interfaces/app-interfaces'
import { getOnlyHumanTimetable } from '../../dbsync/parseSheetRow'

function escapeWithUrls(text: string) {
    return escapeHTML(text).replace(/\[(.+?)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
}

export function cardFormat(row: Event) {

    let text = ``;
    text += `<b>${escapeWithUrls(row.title)}</b>\n`
    text += '\n'
    text += `${escapeWithUrls(row.description)} \n`
    text += '\n'
    text += `<b>Где:</b> ${escapeWithUrls(row.place)}\n`
    const map = row.geotag != '' ? ` <a href="${escapeHTML(row.geotag)}">(Я.Карта)</a>` : ``
    text += `<b>Адрес:</b> ${escapeWithUrls(row.address)}${map}\n`
    text += `<b>Время:</b> ${getOnlyHumanTimetable(row.timetable)}\n`
    if (row.duration != '') {
        text += `<b>Длительность:</b> ${escapeHTML(row.duration)}\n`
    }
    if (row.price != '') {
        text += `<b>Стоимость:</b> ${escapeHTML(row.price)}\n`
    }
    if (row.notes != '') {
        text += `<b>Особенности:</b>  ${escapeWithUrls(row.notes)}\n`
    }
    text += '\n'
    text += `<a href="${escapeHTML(row.url)}">${escapeHTML(row.url)}</a>\n`
    text += '\n'
    text += `${escapeHTML(row.tag_level_3)}\n`

    return text;
}