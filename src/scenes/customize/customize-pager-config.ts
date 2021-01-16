import { ContextMessageUpdate, Event } from '../../interfaces/app-interfaces'
import { CallbackButton } from 'telegraf/typings/markup'
import { BaseScene, Markup } from 'telegraf'
import { SliderConfig } from '../shared/slider-pager'
import { i18nSceneHelper } from '../../util/scene-helper'
import { CustomizeFilters, prepareRepositoryQuery } from './customize-common'
import { db, LimitOffset } from '../../database/db'
import { mySlugify } from '../shared/shared-logic'

const scene = new BaseScene<ContextMessageUpdate>('customize_scene')
const {backButton, actionName, i18nModuleBtnName, revertActionName, scanKeys, i18nSharedBtnName, i18Btn, i18Msg, i18SharedBtn} = i18nSceneHelper(scene)

export class CustomizePagerConfig implements SliderConfig<CustomizeFilters> {

    readonly sceneId = scene.id

    async loadCardsByIds(ctx: ContextMessageUpdate, eventIds: number[]): Promise<Event[]> {
        return await db.repoEventsCommon.getEventsByIds(eventIds)
    }

    async preloadIds(ctx: ContextMessageUpdate, filters: CustomizeFilters, limitOffset: LimitOffset): Promise<number[]> {
        return await db.repoCustomEvents.findEventIdsCustomFilter({
            ...prepareRepositoryQuery(ctx, filters),
            ...limitOffset
        })
    }

    async getTotal(ctx: ContextMessageUpdate, filters: CustomizeFilters): Promise<number> {
        return await db.repoCustomEvents.countEventsCustomFilter({
            ...prepareRepositoryQuery(ctx, filters),
        })
    }

    backButton(ctx: ContextMessageUpdate): CallbackButton {
        return Markup.callbackButton(i18Btn(ctx, 'back'), actionName(`card_back`))
    }

    analytics(ctx: ContextMessageUpdate, event: Event, {limit, offset}: LimitOffset, filters: CustomizeFilters): void {
        const filtersStr = [
            filters.format.length > 0 ? 'format' : undefined,
            filters.oblasti.length > 0 ? 'oblasti' : undefined,
            filters.cennosti.length > 0 ? 'cennosti' : undefined,
            filters.time.length > 0 ? 'time' : undefined,
        ].filter(s => s !== undefined).join('+').replace(/^$/, 'no_filters')

        // const pageTitle = pageNumber > 1 ? ` [Страница ${pageNumber}]` : ''
        ctx.ua.pv({
            dp: `/favorites/${filtersStr}/p${offset + 1}/${event.ext_id}-${mySlugify(event.title)}/`,
            dt: `Избранное > ${filtersStr} > ${event.title} [${offset + 1} / ${limit}]`.trim()
        })
    }
}