import { Markup, Scenes } from 'telegraf'
import { ContextCallbackQueryUpdate, ContextMessageUpdate, Event } from '../../interfaces/app-interfaces'
import { i18nSceneHelper } from '../../util/scene-helper'

import { ITask } from 'pg-promise'
import { IExtensions } from '../../database/db'
import { getInlineKeyboardFromCallbackQuery, updateKeyboardButtons } from '../shared/shared-logic'
import { getFavoriteBtnText } from '../favorites/favorites-common'
import { InlineKeyboardButton } from 'telegraf/typings/telegram-types'

const scene = new Scenes.BaseScene<ContextMessageUpdate>('likes_scene')

const {i18nModuleBtnName, i18Btn, i18Msg, i18SharedBtn} = i18nSceneHelper(scene)

export function getLikeDislikeButtonText(ctx: ContextMessageUpdate, count: number, type: 'like' | 'dislike') {
    return i18Btn(ctx, type, {count: count === 0 ? '' : count})
}

export interface BtnLikeDislikeParams {
    eventId: number
    likesCount: number
    dislikesCount: number
}

export const LIKES_EVENT_ACTION_PREFIXES = ['like_', 'dislike_', 'favorite_']

export function getLikesRow(ctx: ContextMessageUpdate, event: Pick<Event, 'id' | 'likes' | 'dislikes'>): InlineKeyboardButton.CallbackButton[] {
    return [
        Markup.button.callback(getLikeDislikeButtonText(ctx, event.likes, 'like'), `like_${event.id}`),
        Markup.button.callback(getLikeDislikeButtonText(ctx, event.dislikes, 'dislike'), `dislike_${event.id}`),
        Markup.button.callback(getFavoriteBtnText(ctx, isEventInFavorites(ctx, event.id)), `favorite_${event.id}`),
    ]
}

export function isEventInFavorites(ctx: ContextMessageUpdate, eventId: number) {
    return ctx.session.user.eventsFavorite.includes(+eventId)
}

export async function updateLikeDislikeInlineButtons(ctx: ContextCallbackQueryUpdate, dbTask: ITask<IExtensions> & IExtensions, eventId: number) {
    const originalKeyboard = getInlineKeyboardFromCallbackQuery(ctx)

    const [likes, dislikes] = await dbTask.repoEventsCommon.getLikesDislikes(eventId)

    let newKeyboard = await updateKeyboardButtons(originalKeyboard, /^(like|dislike)_/, (btn) => {
        if (btn.callback_data.startsWith('like_')) {
            return {...btn, text: i18Btn(ctx, 'like', {count: likes})}
        } else {
            return {...btn, text: i18Btn(ctx, 'dislike', {count: dislikes})}
        }
    })

    newKeyboard = await updateKeyboardButtons(newKeyboard, /^(favorite)_/, (btn) => {
        return {...btn, text: getFavoriteBtnText(ctx, isEventInFavorites(ctx, eventId))}
    })

    if (JSON.stringify(newKeyboard) !== JSON.stringify(originalKeyboard)) {
        await ctx.editMessageReplyMarkup(newKeyboard)
    }
}