import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { BaseScene } from 'telegraf'
import { i18nSceneHelper } from '../../util/scene-helper'

const scene = new BaseScene<ContextMessageUpdate>('favorites_scene');

const {i18nModuleBtnName, i18Btn, i18Msg, i18SharedBtn} = i18nSceneHelper(scene)

export function getFavoriteBtnText(ctx: ContextMessageUpdate, isFavorite: boolean) {
    return i18Btn(ctx, isFavorite ? 'favorite_done' : 'favorite')
}