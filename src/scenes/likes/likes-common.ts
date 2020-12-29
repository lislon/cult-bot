import { BaseScene, Markup } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { i18nSceneHelper } from '../../util/scene-helper'
import { CallbackButton } from 'telegraf/typings/markup'

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

export function getLikesRow(ctx: ContextMessageUpdate, params: BtnLikeDislikeParams): CallbackButton[] {
    return [
        Markup.callbackButton(getLikeDislikeButtonText(ctx, params.likesCount, 'like'), `like_${params.eventId}`),
        Markup.callbackButton(getLikeDislikeButtonText(ctx, params.dislikesCount, 'dislike'), `dislike_${params.eventId}`),
        Markup.callbackButton(i18SharedBtn(ctx, 'favorite'), `favorite_${params.eventId}`),
    ]
}