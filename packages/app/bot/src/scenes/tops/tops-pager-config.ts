import { SliderConfig, TotalOffset } from '../shared/slider-pager'
import { ContextMessageUpdate, Event } from '../../interfaces/app-interfaces'
import { db, LimitOffset } from '../../database/db'
import { Scenes } from 'telegraf'
import {
    analyticsTopParams,
    getTopEventCount,
    getTopEventIds,
    getTopRangeInterval,
    TopEventsStageQuery
} from './tops-common'
import { mySlugify } from '../shared/shared-logic'
import { i18nSceneHelper } from '../../util/scene-helper'

const scene = new Scenes.BaseScene<ContextMessageUpdate>('tops_scene')
const {sceneHelper, actionName, i18nModuleBtnName, i18Btn, i18Msg, i18SharedBtn} = i18nSceneHelper(scene)

export class TopsPagerConfig implements SliderConfig<TopEventsStageQuery> {

    readonly sceneId = scene.id

    async preloadIds(ctx: ContextMessageUpdate, limitOffset: LimitOffset, query: TopEventsStageQuery): Promise<number[]> {
        return await getTopEventIds(ctx, query, getTopRangeInterval(ctx), limitOffset)
    }

    async getTotal(ctx: ContextMessageUpdate, query: TopEventsStageQuery): Promise<number> {
        return await getTopEventCount(ctx, query, getTopRangeInterval(ctx))
    }

    async loadCardsByIds(ctx: ContextMessageUpdate, eventIds: number[]): Promise<Event[]> {
        return await db.repoEventsCommon.getEventsByIds(eventIds)
    }

    backButtonCallbackData(ctx: ContextMessageUpdate): string {
        return actionName(`back_inline`)
    }

    analytics(ctx: ContextMessageUpdate, event: Event, {total, offset}: TotalOffset, state: TopEventsStageQuery): void {
        const {dp, dt} = analyticsTopParams(state)

        ctx.ua.pv({
            dp: `${dp}p${offset + 1}/${event.extId}-${mySlugify(event.title)}/`,
            dt: `${dt} > ${event.title} [${offset + 1}/${total}]`.trim()
        })
    }


}
