import { ContextMessageUpdate, Event } from '../../interfaces/app-interfaces'
import { BaseScene, Markup } from 'telegraf'
import { i18nSceneHelper } from '../../util/scene-helper'
import { leftDate, MomentIntervals, rightDate } from '../../lib/timetable/intervals'
import { isAfter } from 'date-fns'
import { first, last } from 'lodash'
import { db } from '../../database/db'
import { parseAndPredictTimetable } from '../../lib/timetable/timetable-utils'
import { FavoriteEvent } from './favorites-scene'
import { getLikeDislikeButtonText } from '../likes/likes-common'

const scene = new BaseScene<ContextMessageUpdate>('favorites_scene')

const {i18nModuleBtnName, i18Btn, i18Msg, i18SharedBtn} = i18nSceneHelper(scene)

export function getFavoriteBtnText(ctx: ContextMessageUpdate, isFavorite: boolean) {
    return i18Btn(ctx, isFavorite ? 'favorite_done' : 'favorite')
}

export async function getListOfFavorites(ctx: ContextMessageUpdate, eventIds: number[]): Promise<FavoriteEvent[]> {
    function hasEventsInFuture(timeIntervals: MomentIntervals, date: Date) {
        return timeIntervals.length > 0 && isAfter(rightDate(last(timeIntervals)), date)
    }

    const events = await db.repoEventsCommon.getEventsByIds(eventIds)

    const eventsWithNearestDate = events.map(e => {
        const parsedTimetable = parseAndPredictTimetable(e.timetable, ctx.now())
        return {
            ...e,
            parsedTimetable,
            firstDate: parsedTimetable.timeIntervals.length > 0 ? leftDate(first(parsedTimetable.timeIntervals)) : new Date(0),
            isFuture: hasEventsInFuture(parsedTimetable.timeIntervals, ctx.now())
        } as FavoriteEvent
    })

    return eventsWithNearestDate
}

export function favoriteCardButtonsRow(ctx: ContextMessageUpdate, event: Event) {
    return [
        Markup.callbackButton(getLikeDislikeButtonText(ctx, event.likes, 'like'), `like_${event.id}`),
        Markup.callbackButton(getLikeDislikeButtonText(ctx, event.dislikes, 'dislike'), `dislike_${event.id}`),
        Markup.callbackButton(i18Btn(ctx, 'remove_favorite'), `favorite_${event.id}`),
    ]
}