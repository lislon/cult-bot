import { ContextMessageUpdate, Event } from '../../interfaces/app-interfaces'
import { BaseScene } from 'telegraf'
import { SliderConfig, TotalOffset } from '../shared/slider-pager'
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

    async preloadIds(ctx: ContextMessageUpdate, limitOffset: LimitOffset, query: CustomizeFilters): Promise<number[]> {
        return await db.repoCustomEvents.findEventIdsCustomFilter({
            ...prepareRepositoryQuery(ctx, query),
            ...limitOffset
        })
    }

    noCardsText(ctx: ContextMessageUpdate) {
        return i18Msg(ctx, 'slider_is_empty')
    }

    async getTotal(ctx: ContextMessageUpdate, filters: CustomizeFilters): Promise<number> {
        return await db.repoCustomEvents.countEventsCustomFilter({
            ...prepareRepositoryQuery(ctx, filters),
        })
    }

    backButtonCallbackData(ctx: ContextMessageUpdate): string {
        return actionName(`card_back`)
    }

    analytics(ctx: ContextMessageUpdate, event: Event, {total, offset}: TotalOffset, filters: CustomizeFilters): void {
        function extracted(format: string, oblasti: string, cennosti: string, time: string, noFilters: string) {
            const filtersStr = [
                filters.format.length > 0 ? format : undefined,
                filters.oblasti.length > 0 ? oblasti : undefined,
                filters.cennosti.length > 0 ? cennosti : undefined,
                filters.time.length > 0 ? time : undefined,
            ].filter(s => s !== undefined).join('+').replace(/^$/, noFilters)
            return filtersStr;
        }

        const filtersStr = extracted('format', 'rubrics', 'cennosti', 'time', 'no_filters');
        const filtersStrHuman = extracted('Формат', 'Рубрики', 'Ценности', 'Время', 'Без фильтра');

        // const pageTitle = pageNumber > 1 ? ` [Страница ${pageNumber}]` : ''
        ctx.ua.pv({
            dp: `/customize/${filtersStr}/p${offset + 1}/${event.ext_id}-${mySlugify(event.title)}/`,
            dt: `Подобрать под интересы > ${filtersStrHuman} > ${event.title} [${offset + 1}/${total}]`.trim()
        })
    }
}
