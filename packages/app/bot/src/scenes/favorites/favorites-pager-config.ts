import { ContextMessageUpdate, Event } from '../../interfaces/app-interfaces'

import { Scenes } from 'telegraf'
import { SliderConfig, TotalOffset } from '../shared/slider-pager'
import { i18nSceneHelper } from '../../util/scene-helper'
import { LimitOffset } from '../../database/db'
import { favoriteCardButtonsRow, getSortedFavoriteEventsIds, loadEventsAsFavorite } from './favorites-common'
import { CardOptions } from '../shared/card-format'
import { isEventInFavorites } from '../likes/likes-common'
import { InlineKeyboardButton } from 'typegram'

const scene = new Scenes.BaseScene<ContextMessageUpdate>('favorites_scene')
const {backButton, i18Msg, actionName} = i18nSceneHelper(scene)

export class FavoritesPagerConfig implements SliderConfig<void> {
    readonly sceneId = scene.id

    async loadCardsByIds(ctx: ContextMessageUpdate, ids: number[]): Promise<Event[]> {
        return await loadEventsAsFavorite(ids, ctx.now())
    }

    async preloadIds(ctx: ContextMessageUpdate, {offset, limit}: LimitOffset): Promise<number[]> {
        const eventIds = await getSortedFavoriteEventsIds(ctx)
        if (eventIds.length !== ctx.session.user.eventsFavorite.length) {
            ctx.logger.warn(`Favorites in session ${ctx.session.user.eventsFavorite.join(',')} != ${eventIds.join(',')}`)
        }
        return eventIds.slice(offset, offset + limit)
    }

    async getTotal(ctx: ContextMessageUpdate, snapshotFavoriteIds: void): Promise<number> {
        return ctx.session.user.eventsFavorite.length
    }

    cardFormatOptions(ctx: ContextMessageUpdate, event: Event): CardOptions {
        return {deleted: !isEventInFavorites(ctx, event.id), now: ctx.now()}
    }

    noCardsText(ctx: ContextMessageUpdate) {
        return i18Msg(ctx, 'slider_is_empty')
    }

    async cardButtons?(ctx: ContextMessageUpdate, event: Event): Promise<InlineKeyboardButton.CallbackButton[]> {
        return favoriteCardButtonsRow(ctx, event)
    }

    backButtonCallbackData(ctx: ContextMessageUpdate): string {
        return actionName('back_to_favorite_main')
    }

    analytics(ctx: ContextMessageUpdate, event: Event, {total, offset}: TotalOffset): void {
        const pageTitle = `[${offset + 1}/${total}]`
        ctx.ua.pv({
            dp: `/favorites/p${offset + 1}/`,
            dt: `Избранное > Актуальные карточки ${pageTitle}`.trim()
        })
    }
}
