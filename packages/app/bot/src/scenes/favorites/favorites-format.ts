import { Scenes } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { CtxI18n, i18nSceneHelper } from '../../util/scene-helper'
import { isEventEndsInFuture, isEventStarsInPast, ruFormat } from '../shared/shared-logic'
import { rightDate, TimetableFormatter } from '@culthub/timetable'
import { first, last, partition } from 'lodash'
import { formatCardUrl, markupUrlsToHtml } from '../shared/card-format'
import { fieldIsQuestionMarkOrEmpty } from '../../util/misc-utils'
import { escapeHTML } from '../../util/string-utils'
import { botConfig } from '../../util/bot-config'
import { FavoriteEvent } from './favorites-scene'
import { isAfter } from 'date-fns'

const scene = new Scenes.BaseScene<ContextMessageUpdate>('favorites_scene')

const {i18SharedMsg, i18Msg} = i18nSceneHelper(scene)
const MAX_CARD_LEN = 4096

type FavoriteEventForFormat = Pick<FavoriteEvent, 'place' | 'url' | 'title' | 'category' | 'parsedTimetable' | 'tag_level_1' | 'address'>

function isOnlyWeekdaysSet(event: FavoriteEventForFormat) {
    if (!event.parsedTimetable.parsedTimetable) {
        return false
    }
    const {weekTimes, dateRangesTimetable, datesExact, anytime} = event.parsedTimetable.parsedTimetable
    return weekTimes.length > 0 && dateRangesTimetable.length === 0 && anytime === false && datesExact.length === 0
}

function formatFutureDate(event: FavoriteEventForFormat, ctx: CtxI18n, now: Date) {
    if (event.parsedTimetable.parsedTimetable === undefined) {
        return ''
    }
    if (isOnlyWeekdaysSet(event)) {
        const formattedTimetable = new TimetableFormatter(now, {
            hideTimes: true
        }).structureFormatTimetable(event.parsedTimetable.parsedTimetable)
        return formattedTimetable.weekTimes.join(',')
    }
    if (event.parsedTimetable.parsedTimetable.anytime) {
        return new TimetableFormatter(now, {
            hideTimes: true
        }).formatTimetable(event.parsedTimetable.parsedTimetable)
    }
    if (event.category === 'exhibitions') {
        if (event.parsedTimetable.parsedTimetable.dateRangesTimetable.length > 0) {
            if (isEventStarsInPast(event.parsedTimetable.predictedIntervals, now)) {
                return `до ${ruFormat(rightDate(last(event.parsedTimetable.predictedIntervals)), 'dd MMMM')}`
            }
        }
    }
    return event.parsedTimetable.parsedTimetable.anytime ? i18Msg(ctx, 'date_anytime') : ruFormat(nearestDate(now, event), 'dd MMMM')
}

function formatPastDate(event: FavoriteEventForFormat) {
    const lastInterval = last(event.parsedTimetable.predictedIntervals)
    if (lastInterval === undefined) {
        return `больше ${botConfig.SCHEDULE_WEEKS_AHEAD} недель назад`
    } else {
        return `${ruFormat(rightDate(lastInterval), 'dd MMMM')}`
    }
}


export async function formatListOfFavorites(ctx: CtxI18n, events: FavoriteEventForFormat[], now: Date): Promise<string> {
    const [activeEvents, pastEvents] = partition(events, e => isEventEndsInFuture(e.parsedTimetable.predictedIntervals, now))

    const activeEventsLines = activeEvents.map(event => {
        const details = []
        if (!fieldIsQuestionMarkOrEmpty(event.place)) {
            details.push(`${markupUrlsToHtml(escapeHTML(event.place))}`)
        }
        if (!fieldIsQuestionMarkOrEmpty(event.url)) {
            details.push(' ' + formatCardUrl(event))
        }

        const icon = i18SharedMsg(ctx, 'category_icons.' + event.category)
        return i18Msg(ctx, 'event_item', {
            icon,
            title: event.title ? event.title : i18Msg(ctx, 'event_no_name'),
            place: details.length > 0 ? `\n${details.join(' ')}\n` : '',
            date: formatFutureDate(event, ctx, now)
        })
    })

    const pastEventsLines = pastEvents.map(event => {
        const icon = i18SharedMsg(ctx, 'category_icons.' + event.category)
        return i18Msg(ctx, 'event_item_past', {
            icon,
            title: event.title,
            place: '',
            date: formatPastDate(event)
        })
    })

    let allLines = activeEventsLines

    if (pastEventsLines.length > 0) {
        allLines = [...allLines, i18Msg(ctx, 'past_events_header'), ...pastEventsLines]
    }

    let maxLines = 0
    for (let totalLength = 0; maxLines < allLines.length; maxLines++) {
        if (allLines[maxLines].length + totalLength > MAX_CARD_LEN) {
            break
        }
        totalLength += allLines[maxLines].length
    }
    if (maxLines === allLines.length) {
        return allLines.join('\n')
    }
    return [...allLines.slice(0, maxLines), i18Msg(ctx, 'overflow', {count: allLines.length - maxLines})].join('\n')
}

function nearestDate(now: Date, event: Pick<FavoriteEvent, 'parsedTimetable'>): Date | undefined {
    return first(event.parsedTimetable.predictedIntervals.map(rightDate).filter(rightDate => isAfter(rightDate, now)))
}