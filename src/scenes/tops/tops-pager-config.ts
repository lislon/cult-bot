import { SliderConfig } from '../shared/slider-pager'
import { ContextMessageUpdate, Event } from '../../interfaces/app-interfaces'
import { db, LimitOffset } from '../../database/db'
import { CallbackButton } from 'telegraf/typings/markup'
import { BaseScene, Markup } from 'telegraf'
import {
    analyticsTopParams,
    getTopEventCount,
    getTopEventIds,
    getTopRangeInterval,
    TopEventsStageQuery
} from './tops-common'
import { i18nSceneHelper } from '../../util/scene-helper'
import { mySlugify } from '../shared/shared-logic'

const scene = new BaseScene<ContextMessageUpdate>('tops_scene')
const {sceneHelper, actionName, i18nModuleBtnName, i18Btn, i18Msg, i18SharedBtn} = i18nSceneHelper(scene)

export class TopsPagerConfig implements SliderConfig<TopEventsStageQuery> {

    readonly sceneId = scene.id

    async preloadIds(ctx: ContextMessageUpdate, query: TopEventsStageQuery, limitOffset: LimitOffset): Promise<number[]> {
        return await getTopEventIds(ctx, query, getTopRangeInterval(ctx), limitOffset)
    }

    async getTotal(ctx: ContextMessageUpdate, query: TopEventsStageQuery): Promise<number> {
        return await getTopEventCount(ctx, query, getTopRangeInterval(ctx))
    }

    async loadCardsByIds(ctx: ContextMessageUpdate, eventIds: number[]): Promise<Event[]> {
        return await db.repoEventsCommon.getEventsByIds(eventIds)
    }

    backButton(ctx: ContextMessageUpdate): CallbackButton {
        return Markup.callbackButton(i18Btn(ctx, 'back_inline'), actionName(`back_inline`))
    }

    analytics(ctx: ContextMessageUpdate, event: Event, {limit, offset}: LimitOffset, state: TopEventsStageQuery): void {
        const {dp, dt} = analyticsTopParams(state)

        ctx.ua.pv({
            dp: `${dp}p${offset + 1}/${event.ext_id}-${mySlugify(event.title)}/`,
            dt: `${dt} > ${event.title} [${offset + 1}/${limit}]`.trim()
        })
    }


}
