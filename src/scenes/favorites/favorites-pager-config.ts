import { ContextMessageUpdate, Event } from '../../interfaces/app-interfaces'
import { CallbackButton } from 'telegraf/typings/markup'
import { BaseScene } from 'telegraf'
import { SliderConfig, TotalOffset } from '../shared/slider-pager'
import { i18nSceneHelper } from '../../util/scene-helper'
import { LimitOffset } from '../../database/db'
import { favoriteCardButtonsRow, getListOfFavorites } from './favorites-common'

const scene = new BaseScene<ContextMessageUpdate>('favorites_scene')
const {backButton, actionName, i18nModuleBtnName, revertActionName, scanKeys, i18nSharedBtnName, i18Btn, i18Msg, i18SharedBtn} = i18nSceneHelper(scene)

export class FavoritesPagerConfig implements SliderConfig<number[]> {
    readonly sceneId = scene.id

    async loadCardsByIds(ctx: ContextMessageUpdate, ids: number[]): Promise<Event[]> {
        return await getListOfFavorites(ctx, ids)
    }

    async preloadIds(ctx: ContextMessageUpdate, snapshotFavoriteIds: number[], {offset, limit}: LimitOffset): Promise<number[]> {
        return snapshotFavoriteIds.slice(offset, offset + limit)
    }

    async getTotal(ctx: ContextMessageUpdate, snapshotFavoriteIds: number[]): Promise<number> {
        return snapshotFavoriteIds.length
    }

    async cardButtons?(ctx: ContextMessageUpdate, event: Event): Promise<CallbackButton[]> {
        return favoriteCardButtonsRow(ctx, event)
    }

    backButton(ctx: ContextMessageUpdate): CallbackButton {
        return backButton()
    }

    // analytics(ctx: ContextMessageUpdate, events: Event[], {limit, offset}: LimitOffset) {
    //     const pageNumber = Math.floor(limit / offset) + 1
    //
    //     const pageTitle = pageNumber > 1 ? ` [Страница ${pageNumber}]` : ''
    //     ctx.ua.pv({
    //         dp: `/favorites/${pageNumber > 1 ? `p${pageNumber}/` : ''}`,
    //         dt: `Избранное > Актуальные карточки ${pageTitle}`.trim()
    //     })
    // }
    analytics(ctx: ContextMessageUpdate, event: Event, {total, offset}: TotalOffset, state: number[]): void {
        const pageTitle = `[${offset}/${total}]`
        ctx.ua.pv({
            dp: `/favorites/p${offset}/`,
            dt: `Избранное > Актуальные карточки ${pageTitle}`.trim()
        })
    }


    // async loadCardsByIds(ctx: ContextMessageUpdate, eventIds: number[]): Promise<Event[]> {
    //     return await db.repoEventsCommon.getEventsByIds(eventIds)
    // }
    //
    // async preloadIds(ctx: ContextMessageUpdate, filters: CustomizeFilters, limitOffset: LimitOffset): Promise<number[]> {
    //     return await db.repoCustomEvents.findEventIdsCustomFilter({
    //         ...prepareRepositoryQuery(ctx, filters),
    //         ...limitOffset
    //     })
    // }
    //
    // async getTotal(ctx: ContextMessageUpdate, filters: CustomizeFilters): Promise<number> {
    //     return await db.repoCustomEvents.countEventsCustomFilter({
    //         ...prepareRepositoryQuery(ctx, filters),
    //     })
    // }
    //
    // backButton(ctx: ContextMessageUpdate): CallbackButton {
    //     return Markup.callbackButton(i18Btn(ctx, 'back'), actionName(`card_back`))
    // }
    //
    // analytics(ctx: ContextMessageUpdate, event: Event, {total, offset}: TotalOffset, filters: CustomizeFilters): void {
    //     function extracted(format: string, oblasti: string, cennosti: string, time: string, noFilters: string) {
    //         const filtersStr = [
    //             filters.format.length > 0 ? format : undefined,
    //             filters.oblasti.length > 0 ? oblasti : undefined,
    //             filters.cennosti.length > 0 ? cennosti : undefined,
    //             filters.time.length > 0 ? time : undefined,
    //         ].filter(s => s !== undefined).join('+').replace(/^$/, noFilters)
    //         return filtersStr;
    //     }
    //
    //     const filtersStr = extracted('format', 'rubrics', 'cennosti', 'time', 'no_filters');
    //     const filtersStrHuman = extracted('Формат', 'Рубрики', 'Ценности', 'Время', 'Без фильтра');
    //
    //     // const pageTitle = pageNumber > 1 ? ` [Страница ${pageNumber}]` : ''
    //     ctx.ua.pv({
    //         dp: `/customize/${filtersStr}/p${offset + 1}/${event.ext_id}-${mySlugify(event.title)}/`,
    //         dt: `Подобрать под интересы > ${filtersStrHuman} > ${event.title} [${offset + 1}/${total}]`.trim()
    //     })
    // }
}
