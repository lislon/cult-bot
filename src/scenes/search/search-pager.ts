import { PagingConfig } from '../shared/paging-pager'
import { ContextMessageUpdate, Event } from '../../interfaces/app-interfaces'
import { db, LimitOffset } from '../../database/db'
import { getNextWeekendRange } from '../shared/shared-logic'
import { i18nSceneHelper, isAdmin } from '../../util/scene-helper'
import { BaseScene, Markup } from 'telegraf'
import { SliderConfig, SliderPager } from '../shared/slider-pager';
import { CallbackButton } from 'telegraf/typings/markup';

const scene = new BaseScene<ContextMessageUpdate>('search_scene')
const {sceneHelper, i18nSharedBtnName, actionName, i18Btn, i18Msg, i18SharedMsg, backButton} = i18nSceneHelper(scene)

export class SearchPagerConfig implements SliderConfig<string> {
    readonly limit = 1
    readonly sceneId = scene.id

    async getTotal(ctx: ContextMessageUpdate, query: string): Promise<number> {
        return await db.repoSearch.searchGetTotal({
            query,
            interval: getNextWeekendRange(ctx.now()),
            allowSearchById: isAdmin(ctx)
        })
    }

    async loadCardsByIds(ctx: ContextMessageUpdate, eventIds: number[]): Promise<Event[]> {
        return await db.repoEventsCommon.getEventsByIds(eventIds)
    }

    async preloadIds(ctx: ContextMessageUpdate, query: string, limitOffset: LimitOffset): Promise<number[]> {
        return (await db.repoSearch.searchIds({
            query: ctx.session.search.request,
            interval: getNextWeekendRange(ctx.now()),
            allowSearchById: isAdmin(ctx),
            ...limitOffset
        }))
    }

    async noResults(ctx: ContextMessageUpdate) {
        await ctx.replyWithHTML(i18Msg(ctx, 'no_results'))
    }

    backButton(ctx: ContextMessageUpdate): CallbackButton {
        return backButton(ctx);
    }

    analytics(ctx: ContextMessageUpdate, event: Event, {limit, offset}: LimitOffset, query: string): void {
        const pageNumber = Math.floor(offset / limit) + 1

        const pageTitle = pageNumber > 1 ? ` [Страница ${pageNumber}]` : ''
        ctx.ua.e('Search', 'query', ctx.session.search.request, undefined)
        ctx.ua.pv({
            dp: `/search/${encodeURI(ctx.session.search.request)}/${pageNumber > 1 ? `p${pageNumber}/` : ''}?q=${encodeURIComponent(ctx.session.search.request)}`,
            dt: `Поиск по '${ctx.session.search.request} ${pageTitle}' есть результаты`
        })
    }
}