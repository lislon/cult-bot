import { BaseScene, Markup } from 'telegraf'
import { ContextMessageUpdate, Event } from '../../interfaces/app-interfaces'
import { i18nSceneHelper } from '../../util/scene-helper'
import { CallbackButton } from 'telegraf/typings/markup'
import { ITask } from 'pg-promise'
import { IExtensions } from '../../database/db'
import { getMsgInlineKeyboard, parseAndUpdateBtn } from '../shared/shared-logic'
import { getFavoriteBtnText } from '../favorites/favorites-common'

const scene = new BaseScene<ContextMessageUpdate>('likes_scene');

const {i18nModuleBtnName, i18Btn, i18Msg, i18SharedBtn} = i18nSceneHelper(scene)

export function getLikeDislikeButtonText(ctx: ContextMessageUpdate, count: number, type: 'like' | 'dislike') {
    return i18Btn(ctx, type, {count: count === 0 ? '' : count})
}

export interface BtnLikeDislikeParams {
    eventId: number
    likesCount: number
    dislikesCount: number
}

export function getLikesRow(ctx: ContextMessageUpdate, event: Pick<Event, 'id' | 'likes' | 'dislikes'>): CallbackButton[] {
    return [
        Markup.callbackButton(getLikeDislikeButtonText(ctx, event.likes, 'like'), `like_${event.id}`),
        Markup.callbackButton(getLikeDislikeButtonText(ctx, event.dislikes, 'dislike'), `dislike_${event.id}`),
        Markup.callbackButton(getFavoriteBtnText(ctx, isFavoriteEvent(event.id, ctx)), `favorite_${event.id}`),
    ]
}

export function isFavoriteEvent(eventId: number, ctx: ContextMessageUpdate) {
    return ctx.session.user.eventsFavorite.includes(+eventId)
}

export async function updateLikeDislikeInlineButtons(ctx: ContextMessageUpdate, dbTask: ITask<IExtensions> & IExtensions, eventId: number) {
    const originalKeyboard = getMsgInlineKeyboard(ctx)

    const [likes, dislikes] = await dbTask.repoEventsCommon.getLikesDislikes(eventId)

    let newKeyboard = await parseAndUpdateBtn(originalKeyboard, /^(like|dislike)_/, (btn) => {
        if (btn.callback_data.startsWith('like_')) {
            return {...btn, text: i18Btn(ctx, 'like', {count: likes})}
        } else {
            return {...btn, text: i18Btn(ctx, 'dislike', {count: dislikes})}
        }
    })

    newKeyboard = await parseAndUpdateBtn(newKeyboard, /^(favorite)_/, (btn) => {
        return {...btn, text: getFavoriteBtnText(ctx, isFavoriteEvent(eventId, ctx))}
    })

    if (JSON.stringify(newKeyboard) !== JSON.stringify(originalKeyboard)) {
        await ctx.editMessageReplyMarkup(newKeyboard)
    }
}