import { escapeHTML } from '../../util/string-utils'
import { Event, TagLevel2 } from '../../interfaces/app-interfaces'
import { getOnlyHumanTimetable, hasHumanTimetable } from '../../dbsync/parseSheetRow'
import { cleanTagLevel1 } from '../../util/tag-level1-encoder'
import { fieldIsQuestionMarkOrEmpty } from '../../util/misc-utils'
import { i18n } from '../../util/i18n'
import { AdminEvent } from '../../database/db-admin'
import { formatPrice, parsePrice } from '../../lib/price-parser'
import { parseTimetable, TimetableFormatter } from '@culthub/timetable'
import debugNamespace from 'debug'
import { logger } from '../../util/logger'
import { hasAnyEventsInFuture } from '@culthub/timetable'

const debug = debugNamespace('bot:card-format')

export function addHtmlNiceUrls(text: string): string {
    return text.replace(/\[(.+?)\]\s*\(([^)]+)\)/g, '<a href="$2">$1</a>')
}
export function hasUrlsInside(text: string): boolean {
    return !!text.match(/\[(.+?)\]\s*\(([^)]+)\)/)
}

export function formatUrl(text: string) {
    const niceUrls = addHtmlNiceUrls(text)
    if (niceUrls === text && text.match(/^https?:\/\//)) {
        return `<a href="${text}">(ссылка на событие)</a>`
    }
    return niceUrls
}

export interface FormatCardTimetableOptions {
    now: Date
    hideNonHolidays?: boolean
}

export function formatCardTimetable(event: Event, options: FormatCardTimetableOptions): string {
    const rawTimetable = event.timetable
    if (hasHumanTimetable(rawTimetable)) {
        return getOnlyHumanTimetable(rawTimetable);
    }

    function formatCinemaUrls(humanTimetable: string) {
        const lines = humanTimetable.split(/[\n\r]+/)
        return lines
            .map(l => l.trim())
            .map(l => l.replace(/:[^(]*[(](http.+?)[)]/, ': <a href="$1">расписание</a>'))
            .filter(l => l !== '')
            .map(l => `${l}`)
            .join('\n')
    }

    function cutYear(humanTimetable: string) {
        return humanTimetable.replace(/^\d+ [а-яА-Я]+(\s+\d+)?\s*-\s*/g, 'до ')
    }
    const structured = parseTimetable(rawTimetable, options.now);
    let formatted: string;
    if (structured.status === true) {
        formatted =  new TimetableFormatter(options.now, {
            hidePast: !!hasAnyEventsInFuture(structured.value, options.now),
            hideFutureExactDates: event.category === 'theaters',
            hideNonHolidays: options.hideNonHolidays
        }).formatTimetable(structured.value)

        // be save
        if (formatted === '') {
            logger.error(`Timetable is empty! for ${event.extId}: ${event.timetable}`)
            return event.timetable
        }

    } else {
        logger.warn(`Fail to format timetable for event='${event.extId}'`)
        formatted = cutYear(rawTimetable)
    }
    return formatCinemaUrls(formatted)
}

export function formatEventDuration(text: string): string {
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

export function getCardHeaderCat(row: Event): string {
    const icon = i18n.t(`ru`, `shared.category_icons.${row.category}`)
    const title = i18n.t(`ru`, `shared.category_single_title.${row.category}`)
    return `${icon} <b>${title.toUpperCase()}</b>`
}

export interface CardOptions {
    showAdminInfo?: boolean
    deleted?: boolean
    showDetails?: boolean
    now: Date
}

export interface EventWithPast extends Event {
    isFuture: boolean
}

export function filterTagLevel2(row: Event | AdminEvent): TagLevel2[] {
    let tags = row.tag_level_2;
    if (tags.includes('#_последнийшанс') && !tags.includes('#последнийшанс')) {
        tags = [...tags, '#последнийшанс']
    }
    tags = tags.filter(t => !t.startsWith('#_'))
    return tags
}

function isCardWithPossiblePast(row: Event | EventWithPast): row is EventWithPast {
    return (row as EventWithPast).isFuture !== undefined
}

function wrapInUrl(content: string, url: string) {
    if (fieldIsQuestionMarkOrEmpty(url) || hasUrlsInside(content)) {
        return addHtmlNiceUrls(content)
    }
    return `<a href="${url}">${content}</a>`
}

export function cardFormat(row: Event | AdminEvent | EventWithPast, options: CardOptions): string {
    let text = ``
    debug('formatting card')
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

    function strikeIfDeleted(text: string) {
        return options.deleted ? `<s>${text}</s>` : text
    }

    text += strikeIfDeleted(`${getCardHeaderCat(row)} <b>${escapeHTML(row.tag_level_1.map(t => cleanTagLevel1(t)).join(' '))}</b>`)
    if (options.showAdminInfo === true) {
        text += ` <i>${row.extId}</i> `
    }

    text += '\n'
    text += '\n'

    const gone = isFuture ? '' : ` <i>(прошло)</i>`

    text += strikeIfDeleted(`<b>${escapeHTML(row.title)}</b>${gone}`)
    text += '\n'

    if (options.deleted) {
        text += '\n'.repeat(7)
        text += 'Событие убрано из избранного.'
        text += '\n'.repeat(7)
        text += 'Чтобы вернуть его, нажмите на ↩️'
        return text
    }

    text += '\n'

    if (isFuture) {
        text += `${formatCardTimetable(row, { now: options.now })}\n`
    } else {
        text += `<s>${formatCardTimetable(row, { now: options.now })}</s>\n`
    }
    text += `+ ${wrapInUrl('info', row.url)}\n`
    const priceLine: string[] = []
    if (!fieldIsQuestionMarkOrEmpty(row.duration)) {
        priceLine.push(escapeHTML(formatEventDuration(row.duration)))
    }
    if (!fieldIsQuestionMarkOrEmpty(row.price)) {
        priceLine.push(addHtmlNiceUrls(escapeHTML(formatPrice(parsePrice((row.price))))))
    }
    if (priceLine.length > 0) {
        text += `<i>${priceLine.join(' | ')}</i>\n`
    }

    text += '\n'
    text += `${strikeIfDeleted(addHtmlNiceUrls(escapeHTML(row.description)))} \n`
    text += '\n'


    if (!fieldIsQuestionMarkOrEmpty(row.place)) {
        text += `<b>${addHtmlNiceUrls(escapeHTML(row.place))}</b>\n`
    }

    if (!fieldIsQuestionMarkOrEmpty(row.address)) {
        text += `${wrapInUrl(escapeHTML(row.address), row.geotag)}\n`
    }

    if (!fieldIsQuestionMarkOrEmpty(row.notes) && options.showDetails) {
        text += `<b>Особенности:</b> ${addHtmlNiceUrls(escapeHTML(row.notes))}\n`
    }
    text += '\n'
    if (options.showDetails) {
        text += `${strikeIfDeleted(escapeHTML([...row.tag_level_3, ...(filterTagLevel2(row))].join(' ')))}\n`
    }

    debug('card formatted')
    return text
}
