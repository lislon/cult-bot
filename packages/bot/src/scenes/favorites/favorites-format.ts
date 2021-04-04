import { Scenes } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { CtxI18n, i18nSceneHelper } from '../../util/scene-helper'
import { isEventEndsInFuture, isEventStarsInPast, ruFormat } from '../shared/shared-logic'
import { rightDate, TimetableFormatter } from '@culthub/timetable'
import { first, last } from 'lodash'
import { addHtmlNiceUrls, formatUrl } from '../shared/card-format'
import { fieldIsQuestionMarkOrEmpty } from '../../util/misc-utils'
import { escapeHTML } from '../../util/string-utils'
import { botConfig } from '../../util/bot-config'
import { FavoriteEvent } from './favorites-scene'
import { isAfter } from "date-fns"

const scene = new Scenes.BaseScene<ContextMessageUpdate>('favorites_scene')

const {i18SharedMsg, i18Btn, i18Msg, i18SharedBtn, backButton, actionName, actionNameRegex} = i18nSceneHelper(scene)

type FavoriteEventForFormat = Pick<FavoriteEvent, 'place' | 'url' | 'title' | 'category' | 'parsedTimetable'>

function isOnlyWeekdaysSet(event: FavoriteEventForFormat) {
    const { weekTimes, dateRangesTimetable, datesExact, anytime} = event.parsedTimetable.parsedTimetable
    return weekTimes.length > 0 && dateRangesTimetable.length === 0 && anytime === false && datesExact.length === 0
}

function formatFutureDate(event: FavoriteEventForFormat, ctx: CtxI18n, now: Date) {
    if (isOnlyWeekdaysSet(event)) {
        const formattedTimetable = new TimetableFormatter(now, {
            hideTimes: true
        }).structureFormatTimetable(event.parsedTimetable.parsedTimetable)
        return formattedTimetable.weekTimes.join(', ')
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
    if (event.parsedTimetable.predictedIntervals.length === 0) {
        return `больше ${botConfig.SCHEDULE_WEEKS_AHEAD} недель назад`
    } else {
        return `${ruFormat(rightDate(last(event.parsedTimetable.predictedIntervals)), 'dd MMMM')}`
    }
}

export async function formatListOfFavorites(ctx: CtxI18n, events: FavoriteEventForFormat[], now: Date): Promise<string> {
    return events.map(event => {
        const details = []
        if (!fieldIsQuestionMarkOrEmpty(event.place)) {
            details.push(`🌐 ${addHtmlNiceUrls(escapeHTML(event.place))}`)
        }
        if (!fieldIsQuestionMarkOrEmpty(event.url)) {
            details.push(`${formatUrl(escapeHTML(event.url))}`)
        }

        const icon = i18SharedMsg(ctx, 'category_icons.' + event.category)
        if (isEventEndsInFuture(event.parsedTimetable.predictedIntervals, now)) {
            return i18Msg(ctx, 'event_item', {
                icon,
                title: event.title,
                place: details.length > 0 ? `\n${details.join(', ')}\n` : '',
                date: formatFutureDate(event, ctx, now)
            })
        } else {

            return i18Msg(ctx, 'event_item_past', {
                icon,
                title: event.title,
                place: '',
                date: formatPastDate(event)
            })
        }
    }).join('\n')
}

function nearestDate(now: Date, event: Pick<FavoriteEvent, 'parsedTimetable'>): Date {
    return first(event.parsedTimetable.predictedIntervals.map(rightDate).filter(rightDate => isAfter(rightDate, now)))
}