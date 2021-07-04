import { ContextMessageUpdate, Event, DateInterval } from '../../interfaces/app-interfaces'
import { db, LimitOffset } from '../../database/db'
import { SliderConfig, TotalOffset } from '../shared/slider-pager'
import { Scenes } from 'telegraf'
import { isAdmin } from '../../util/scene-utils'
import { i18nSceneHelper } from '../../util/scene-helper'

const scene = new Scenes.BaseScene<ContextMessageUpdate>('search_scene')
const {i18Msg, backButton} = i18nSceneHelper(scene)

export class SearchPagerConfig implements SliderConfig<string> {
    readonly limit = 1
    readonly sceneId = scene.id

    async getTotal(ctx: ContextMessageUpdate, query: string): Promise<number> {
        return await db.repoSearch.searchGetTotal({
            query,
            interval: this.getSearchInterval(ctx.now()),
            allowSearchById: isAdmin(ctx)
        })
    }

    async loadCardsByIds(ctx: ContextMessageUpdate, eventIds: number[]): Promise<Event[]> {
        return await db.repoEventsCommon.getEventsByIds(eventIds)
    }

    async preloadIds(ctx: ContextMessageUpdate, limitOffset: LimitOffset, query: string): Promise<number[]> {
        return (await db.repoSearch.searchIds({
            query: ctx.session.search.request,
            interval: this.getSearchInterval(ctx.now()),
            allowSearchById: isAdmin(ctx),
            ...limitOffset
        }))
    }

    noCardsText(ctx: ContextMessageUpdate) {
        return i18Msg(ctx, 'slider_is_empty')
    }

    async noResults(ctx: ContextMessageUpdate) {
        await ctx.replyWithHTML(i18Msg(ctx, 'no_results'))
    }

    backButtonCallbackData(ctx: ContextMessageUpdate): string {
        return backButton().callback_data
    }

    analytics(ctx: ContextMessageUpdate, event: Event, {total, offset}: TotalOffset, query: string): void {
        ctx.ua.e('Search', 'query', ctx.session.search.request, undefined)
        ctx.ua.pv({
            dp: `/search/${encodeURI(ctx.session.search.request)}/p${offset + 1}/?q=${encodeURIComponent(ctx.session.search.request)}`,
            dt: `Поиск по '${ctx.session.search.request}' [${offset + 1}/${total}]`
        })
    }

    private getSearchInterval(now: Date): DateInterval {
        return {
            start: now,
            end: new Date(3000, 1, 1)
        }
    }

}
