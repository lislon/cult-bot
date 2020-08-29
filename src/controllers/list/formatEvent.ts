import { escapeHTML } from '../../util/string-utils'

export function formatEvent(row: Event) {

    let text = ``;
    text += `<b>${escapeHTML(row.title)}</b>\n`
    text += '\n'
    text += `${row.description} \n`
    text += '\n'
    text += `<b>Где:</b> ${row.address}\n`
    text += `<b>Время:</b> ${row.timetable}\n`
    text += `<b>Длительность:</b> ${row.duration}\n`
    text += `<b>Стоимость:</b> ${row.price}\n`
    text += `<b>Особенности:</b>  ${row.notes}\n`
    text += '\n'
    text += `<a href="${row.url}">${row.url}</a>\n`
    text += '\n'
    text += `${escapeHTML(row.tag_level_1)}\n`
    text += `${escapeHTML(row.tag_level_2)}\n`
    text += `${escapeHTML(row.tag_level_3)}\n`
    console.log(text)
    return text;
}