import { Markup, Scenes } from 'telegraf'
import { ContextCallbackQueryUpdate, ContextMessageUpdate, Event } from '../../interfaces/app-interfaces'
import { i18nSceneHelper } from '../../util/scene-helper'

import { ITask } from 'pg-promise'
import { IExtensions } from '../../database/db'
import { getInlineKeyboardFromCallbackQuery, updateKeyboardButtons } from '../shared/shared-logic'
import { getFavoriteBtnText } from '../favorites/favorites-common'
import { InlineKeyboardButton } from 'typegram'

const scene = new Scenes.BaseScene<ContextMessageUpdate>('likes_scene')

const {i18Btn} = i18nSceneHelper(scene)

export function getLikeDislikeButtonText(ctx: ContextMessageUpdate, count: number, type: 'like' | 'dislike'): string {
    return i18Btn(ctx, type, {maybeCount: count === 0 ? '' : ` ${count}`})
}
export const LIKES_EVENT_ACTION_PREFIXES = ['like_', 'dislike_', 'favorite_']

export function getLikesRow(ctx: ContextMessageUpdate, event: Pick<Event, 'id' | 'likes' | 'dislikes'>): InlineKeyboardButton.CallbackButton[] {
    return [
        Markup.button.callback(getLikeDislikeButtonText(ctx, event.likes, 'like'), `like_${event.id}`),
        Markup.button.callback(getLikeDislikeButtonText(ctx, event.dislikes, 'dislike'), `dislike_${event.id}`),
        Markup.button.callback(getFavoriteBtnText(ctx, isEventInFavorites(ctx, event.id)), `favorite_${event.id}`),
    ]
}

export function isEventInFavorites(ctx: ContextMessageUpdate, eventId: number): boolean {
    return ctx.session.user.eventsFavorite.includes(+eventId)
}

export async function updateLikeDislikeInlineButtons(ctx: ContextCallbackQueryUpdate, dbTask: ITask<IExtensions> & IExtensions, eventId: number): Promise<void> {
    const originalKeyboard = getInlineKeyboardFromCallbackQuery(ctx)

    const [likes, dislikes] = await dbTask.repoEventsCommon.getLikesDislikes(eventId)

    let newKeyboard = await updateKeyboardButtons(originalKeyboard, /^(like|dislike)_/, (btn) => {
        if (btn.callback_data.startsWith('like_')) {
            return {...btn, text: getLikeDislikeButtonText(ctx, likes, 'like')}
        } else {
            return {...btn, text: getLikeDislikeButtonText(ctx, dislikes, 'dislike')}
        }
    })

    newKeyboard = await updateKeyboardButtons(newKeyboard, /^(favorite)_/, (btn) => {
        return {...btn, text: getFavoriteBtnText(ctx, isEventInFavorites(ctx, eventId))}
    })

    if (JSON.stringify(newKeyboard) !== JSON.stringify(originalKeyboard)) {
        await ctx.editMessageReplyMarkup(newKeyboard)
    }
}