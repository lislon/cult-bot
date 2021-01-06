import { BaseScene, Markup } from 'telegraf'
import { ContextMessageUpdate, Event } from '../../interfaces/app-interfaces'
import { i18nSceneHelper } from '../../util/scene-helper'
import { CallbackButton } from 'telegraf/typings/markup'
import { InlineKeyboardButton, InlineKeyboardMarkup } from 'telegram-typings'
import { ITask } from 'pg-promise'
import { IExtensions } from '../../database/db'

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

export function getFavoriteBtnText(ctx: ContextMessageUpdate, isFavorite: boolean) {
    return i18Btn(ctx, isFavorite ? 'favorite_done' : 'favorite')
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

async function parseAndUpdateBtn(replyMarkup: InlineKeyboardMarkup,
                                 callbackDataToken: RegExp, updateFunc: (text: InlineKeyboardButton) => (InlineKeyboardButton)): Promise<undefined | InlineKeyboardMarkup> {
    if (replyMarkup !== undefined) {
        const newKeyboard: InlineKeyboardButton[][] = []
        for (const row of replyMarkup.inline_keyboard) {
            newKeyboard.push(
                row.map(btn => {
                    if (btn.callback_data.match(callbackDataToken)) {
                        return updateFunc(btn)
                    }
                    return btn;
                }))
        }
        return {inline_keyboard: newKeyboard}
    }
    return undefined
}

export async function updateLikeDislikeInlineButtons(ctx: ContextMessageUpdate, dbTask: ITask<IExtensions> & IExtensions, eventId: number) {
    const orignalKeyboard = (ctx.update.callback_query.message as any)?.reply_markup as InlineKeyboardMarkup

    const [likes, dislikes] = await dbTask.repoEventsCommon.getLikesDislikes(eventId)

    let newKeyboard = await parseAndUpdateBtn(orignalKeyboard, /^(like|dislike)_/, (btn) => {
        if (btn.callback_data.startsWith('like_')) {
            return {...btn, text: i18Btn(ctx, 'like', {count: likes})}
        } else {
            return {...btn, text: i18Btn(ctx, 'dislike', {count: dislikes})}
        }
    })

    newKeyboard = await parseAndUpdateBtn(newKeyboard, /^(favorite)_/, (btn) => {
        return {...btn, text: getFavoriteBtnText(ctx, isFavoriteEvent(eventId, ctx))}
    })

    if (JSON.stringify(newKeyboard) !== JSON.stringify(orignalKeyboard)) {
        await ctx.editMessageReplyMarkup(newKeyboard)
    }
}