import { escapeHTML } from '../../util/string-utils'
import { Event } from '../../interfaces/app-interfaces'
import { getOnlyHumanTimetable } from '../../dbsync/parseSheetRow'
import { cleanTagLevel1 } from '../../util/tag-level1-encoder'
import { fieldIsQuestionMarkOrEmpty } from '../../util/misc-utils'
import { i18n } from '../../util/i18n'
import { AdminEvent } from '../../database/db-admin'
import { formatPrice, parsePrice } from '../../lib/price-parser'

export function addHtmlNiceUrls(text: string) {
    return text.replace(/\[(.+?)\]\s*\(([^)]+)\)/g, '<a href="$2">$1</a>')
}

export function formatUrl(text: string) {
    const niceUrls = addHtmlNiceUrls(text)
    if (niceUrls === text && text.match(/^https?:\/\//)) {
        return `<a href="${text}">(ссылка на событие)</a>`
    }
    return niceUrls
}

export function formatTimetable(event: Event) {
    const humanTimetable = getOnlyHumanTimetable(event.timetable);

    function formatCinemaUrls(humanTimetable: string) {
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

    return formatCinemaUrls(cutYear(humanTimetable))
}

export function formatEventDuration(text: string) {
    const m = text.match(/(\d+)\s*мин[^ ]*/)
    if (m && +m[1] >= 60) {
        const rawMinutes = +m[1]
        const hours = Math.floor(rawMinutes / 60)
        const minutes = rawMinutes % 60
        const format = minutes > 0 ? `${hours} ч ${minutes} мин` : `${hours} ч`
        return text.replace(/(\d+)\s*мин[^ ]*/, format)
    }
    return text
}

export function getCardHeaderCat(row: Event) {
    const icon = i18n.t(`ru`, `shared.category_icons.${row.category}`)
    const title = i18n.t(`ru`, `shared.category_single_title.${row.category}`)
    return `${icon} <b>${title.toUpperCase()}</b>`
}

export interface CardOptions {
    showAdminInfo?: boolean
    packs?: boolean
    deleted?: boolean
}

export interface EventWithPast extends Event {
    isFuture: boolean
}

export function filterTagLevel2(row: Event | AdminEvent) {
    return row.tag_level_2.filter(t => !t.startsWith('#_'))
}

function isCardWithPossiblePast(row: Event | EventWithPast): row is EventWithPast {
    return (row as EventWithPast).isFuture !== undefined
}

export function cardFormat(row: Event | AdminEvent | EventWithPast, options: CardOptions = {showAdminInfo: false}) {
    let text = ``
    const rowWithOldVersion = row as AdminEvent
    if (rowWithOldVersion.snapshotStatus !== undefined) {
        if (rowWithOldVersion.snapshotStatus === 'inserted') {
            text += '<b>[NEW]</b> '
        } else if (rowWithOldVersion.snapshotStatus === 'updated') {
            text += '<b>[MOD]</b> '
        } else {
            text += '[OLD] '
        }
    }
    const isFuture = !(isCardWithPossiblePast(row) && row.isFuture == false)

    // if (options.packs) {
    //     text += `<b>${addHtmlNiceUrls(escapeHTML(row.title))}</b>`
    //     text += '\n'
    //     text += '\n'
    //     text += `<b>${escapeHTML(row.tag_level_1.map(t => cleanTagLevel1(t)).join(' '))}</b>`
    // } else {
    //
    // }

    function strikeIfDeleted(text: string) {
        return options.deleted ? `<s>${text}</s>` : text
    }

    text += strikeIfDeleted(`${getCardHeaderCat(row)} <b>${escapeHTML(row.tag_level_1.map(t => cleanTagLevel1(t)).join(' '))}</b>`)

    text += '\n'
    text += '\n'

    if (isFuture) {
        text += strikeIfDeleted(`<b>${addHtmlNiceUrls(escapeHTML(row.title))}</b>`)
    } else {
        text += strikeIfDeleted(`<b>${addHtmlNiceUrls(escapeHTML(row.title))}</b> <i>(прошло)</i>`)
    }

    if (options.deleted) {
        text += '\n'.repeat(7)
        text += 'Событие убрано из избранного.'
        text += '\n'.repeat(7)
        text += 'Чтобы вернуть его, нажмите на ↩️'
        return text
    }

    text += '\n'
    text += '\n'
    text += `${strikeIfDeleted(addHtmlNiceUrls(escapeHTML(row.description)))} \n`
    text += '\n'


    if (!fieldIsQuestionMarkOrEmpty(row.place)) {
        text += `🌐 ${addHtmlNiceUrls(escapeHTML(row.place))}\n`
    }
    const map = row.geotag != '' ? ` <a href="${escapeHTML(row.geotag)}">(Я.Карта)</a>` : ``
    if (!fieldIsQuestionMarkOrEmpty(row.address)) {
        text += `📍 ${addHtmlNiceUrls(escapeHTML(row.address))}${map}\n`
    }
    if (isFuture) {
        text += formatTimetable(row)
    } else {
        text += `<s>${formatTimetable(row)}</s>`
    }
    if (!fieldIsQuestionMarkOrEmpty(row.duration)) {
        text += `🕐 ${escapeHTML(formatEventDuration(row.duration))}\n`
    }
    if (!fieldIsQuestionMarkOrEmpty(row.price)) {
        text += `💳 ${addHtmlNiceUrls(escapeHTML(formatPrice(parsePrice((row.price)))))}\n`
    }
    if (!fieldIsQuestionMarkOrEmpty(row.notes)) {
        text += `<b>Особенности:</b>  ${addHtmlNiceUrls(escapeHTML(row.notes))}\n`
    }
    if (!fieldIsQuestionMarkOrEmpty(row.url)) {
        text += `${formatUrl(escapeHTML(row.url))}\n`
    }
    text += '\n'
    text += `${strikeIfDeleted(escapeHTML([...row.tag_level_3, ...(filterTagLevel2(row))].join(' ')))}\n`
    if (options.showAdminInfo === true) {
        text += `<i>${row.extId}, ${row.reviewer}, оценка ${row.rating}</i>\n`
    }

    return text
}