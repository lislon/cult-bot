import { ContextMessageUpdate, Event } from '../../interfaces/app-interfaces'
import { Markup, Scenes } from 'telegraf'
import { i18nSceneHelper } from '../../util/scene-helper'
import { leftDate } from '@culthub/timetable'
import { compareAsc, compareDesc } from 'date-fns'
import { first } from 'lodash'
import { db } from '../../database/db'
import { parseAndPredictTimetable } from '../../lib/timetable/timetable-utils'
import { FavoriteEvent } from './favorites-scene'
import { getLikeDislikeButtonText, isEventInFavorites } from '../likes/likes-common'
import { isEventInFuture } from '../shared/shared-logic'
import { botConfig } from '../../util/bot-config'

const scene = new Scenes.BaseScene<ContextMessageUpdate>('favorites_scene')

const {i18nModuleBtnName, i18Btn, i18Msg, i18SharedBtn, actionName} = i18nSceneHelper(scene)

export function getFavoriteBtnText(ctx: ContextMessageUpdate, isFavorite: boolean) {
    return i18Btn(ctx, isFavorite ? 'favorite_done' : 'favorite')
}

export async function loadEventsAsFavorite(eventIds: number[], now: Date): Promise<FavoriteEvent[]> {
    const events = await db.repoEventsCommon.getEventsByIds(eventIds)

    const eventsWithNearestDate = events.map(e => {
        const parsedTimetable = parseAndPredictTimetable(e.timetable, now, botConfig)
        return {
            ...e,
            parsedTimetable,
            firstDate: parsedTimetable.predictedIntervals.length > 0 ? leftDate(first(parsedTimetable.predictedIntervals)) : new Date(0),
            isFuture: isEventInFuture(parsedTimetable.predictedIntervals, now)
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

                if (left.parsedTimetable.parsedTimetable.anytime === false && right.parsedTimetable.parsedTimetable.anytime === false) {
                    return compareAsc(left.firstDate, right.firstDate)
                } else if (left.parsedTimetable.parsedTimetable.anytime === true) {
                    return 1
                } else if (right.parsedTimetable.parsedTimetable.anytime === true) {
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