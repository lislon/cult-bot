import { ContextMessageUpdate, Event } from '../../interfaces/app-interfaces'
import { CallbackButton } from 'telegraf/typings/markup'
import { BaseScene } from 'telegraf'
import { SliderConfig, TotalOffset } from '../shared/slider-pager'
import { i18nSceneHelper } from '../../util/scene-helper'
import { LimitOffset } from '../../database/db'
import { favoriteCardButtonsRow, getSortedFavoriteEventsIds, loadEventsAsFavorite } from './favorites-common'
import { CardOptions } from '../shared/card-format'
import { isEventInFavorites } from '../likes/likes-common'

const scene = new BaseScene<ContextMessageUpdate>('favorites_scene')
const {backButton, i18Msg} = i18nSceneHelper(scene)

export class FavoritesPagerConfig implements SliderConfig<void> {
    readonly sceneId = scene.id

    async loadCardsByIds(ctx: ContextMessageUpdate, ids: number[]): Promise<Event[]> {
        return await loadEventsAsFavorite(ids, ctx.now())
    }

    async preloadIds(ctx: ContextMessageUpdate, {offset, limit}: LimitOffset): Promise<number[]> {
        return (await getSortedFavoriteEventsIds(ctx)).slice(offset, offset + limit)
    }

    async getTotal(ctx: ContextMessageUpdate, snapshotFavoriteIds: void): Promise<number> {
        return ctx.session.user.eventsFavorite.length
    }

    cardFormatOptions(ctx: ContextMessageUpdate, event: Event): CardOptions {
        return {deleted: !isEventInFavorites(ctx, event.id)}
    }

    noCardsText(ctx: ContextMessageUpdate) {
        return i18Msg(ctx, 'slider_is_empty')
    }

    async cardButtons?(ctx: ContextMessageUpdate, event: Event): Promise<CallbackButton[]> {
        return favoriteCardButtonsRow(ctx, event)
    }

    backButton(ctx: ContextMessageUpdate): CallbackButton {
        return backButton()
    }

    analytics(ctx: ContextMessageUpdate, event: Event, {total, offset}: TotalOffset): void {
        const pageTitle = `[${offset}/${total}]`
        ctx.ua.pv({
            dp: `/favorites/p${offset}/`,
            dt: `Избранное > Актуальные карточки ${pageTitle}`.trim()
        })
    }
}