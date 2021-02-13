import { ContextMessageUpdate, Event } from '../../interfaces/app-interfaces'
import { Markup, Scenes } from 'telegraf'
import { i18nSceneHelper } from '../../util/scene-helper'
import { leftDate, MomentIntervals, rightDate } from '../../lib/timetable/intervals'
import { compareAsc, compareDesc, isAfter } from 'date-fns'
import { first, last } from 'lodash'
import { db } from '../../database/db'
import { parseAndPredictTimetable } from '../../lib/timetable/timetable-utils'
import { FavoriteEvent } from './favorites-scene'
import { getLikeDislikeButtonText, isEventInFavorites } from '../likes/likes-common'

const scene = new Scenes.BaseScene<ContextMessageUpdate>('favorites_scene')

const {i18nModuleBtnName, i18Btn, i18Msg, i18SharedBtn, actionName} = i18nSceneHelper(scene)

export function getFavoriteBtnText(ctx: ContextMessageUpdate, isFavorite: boolean) {
    return i18Btn(ctx, isFavorite ? 'favorite_done' : 'favorite')
}

export async function loadEventsAsFavorite(eventIds: number[], now: Date): Promise<FavoriteEvent[]> {
    function hasEventsInFuture(timeIntervals: MomentIntervals, date: Date) {
        return timeIntervals.length > 0 && isAfter(rightDate(last(timeIntervals)), date)
    }

    const events = await db.repoEventsCommon.getEventsByIds(eventIds)

    const eventsWithNearestDate = events.map(e => {
        const parsedTimetable = parseAndPredictTimetable(e.timetable, now)
        return {
            ...e,
            parsedTimetable,
            firstDate: parsedTimetable.timeIntervals.length > 0 ? leftDate(first(parsedTimetable.timeIntervals)) : new Date(0),
            isFuture: hasEventsInFuture(parsedTimetable.timeIntervals, now)
        } as FavoriteEvent
    })

    return eventsWithNearestDate
}

export function removeFavoriteButton(ctx: ContextMessageUpdate, event: Event) {
    if (isEventInFavorites(ctx, event.id)) {
        return Markup.button.callback(i18Btn(ctx, 'remove_favorite'), actionName(`remove_${event.id}`))
    } else {
        return Markup.button.callback(i18Btn(ctx, 'restore_favorite'), actionName(`restore_${event.id}`))
    }
}

export function favoriteCardButtonsRow(ctx: ContextMessageUpdate, event: Event) {
    return [
        Markup.button.callback(getLikeDislikeButtonText(ctx, event.likes, 'like'), `like_${event.id}`),
        Markup.button.callback(getLikeDislikeButtonText(ctx, event.dislikes, 'dislike'), `dislike_${event.id}`),
        removeFavoriteButton(ctx, event),
    ]
}

export function sortFavorites(events: FavoriteEvent[]) {
    return [...events].sort((left, right) => {
            if (left.isFuture === true && right.isFuture === true) {

                if (left.parsedTimetable.timetable.anytime === false && right.parsedTimetable.timetable.anytime === false) {
                    return compareAsc(left.firstDate, right.firstDate)
                } else if (left.parsedTimetable.timetable.anytime === true) {
                    return 1
                } else if (right.parsedTimetable.timetable.anytime === true) {
                    return -1
                } else {
                    return 0
                }

            } else if (left.isFuture === false && right.isFuture === false) {
                return compareDesc(left.firstDate, right.firstDate)
            } else {
                return left.isFuture ? -1 : 1
            }
        }
    )
}

export async function getSortedFavoriteEventsIds(ctx: ContextMessageUpdate) {
    return sortFavorites(await loadEventsAsFavorite(ctx.session.user.eventsFavorite, ctx.now())).map(e => e.id)
}