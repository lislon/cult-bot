import { CAT_NAMES, ContextMessageUpdate, EventCategory, MyInterval } from '../../interfaces/app-interfaces'
import { getNextWeekendRange } from '../shared/shared-logic'
import { db, LimitOffset } from '../../database/db'
import { encodeTagsLevel1 } from '../../util/tag-level1-encoder'
import { BaseScene } from 'telegraf'
import { i18nSceneHelper } from '../../util/scene-helper'

const scene = new BaseScene<ContextMessageUpdate>('tops_scene')
const {sceneHelper, actionName, i18nModuleBtnName, i18Btn, i18Msg, i18SharedBtn} = i18nSceneHelper(scene)

export type SubMenuVariants = 'exhibitions_temp' | 'exhibitions_perm'

export interface TopEventsStageQuery {
    cat: EventCategory
    submenuSelected: SubMenuVariants
}

export interface TopsSceneState extends TopEventsStageQuery {
    isWatchingEvents: boolean
    isInSubMenu: boolean
}

function getOblasti(ctx: ContextMessageUpdate, query: TopEventsStageQuery) {
    if (query.submenuSelected !== undefined) {
        return encodeTagsLevel1('exhibitions', [i18Msg(ctx, `exhibitions_tags.${query.submenuSelected}`)])
    }
    return []
}

export function getTopRangeInterval(ctx: ContextMessageUpdate) {
    return getNextWeekendRange(ctx.now())
}

export async function getTopEventIds(ctx: ContextMessageUpdate, query: TopEventsStageQuery, range: MyInterval, limitOffset: LimitOffset): Promise<number[]> {
    return await db.repoTopEvents.getTopIds({
        category: query.cat,
        interval: range,
        oblasti: getOblasti(ctx, query),
        ...limitOffset,
    })
}

export async function getTopEventCount(ctx: ContextMessageUpdate, query: TopEventsStageQuery, range: MyInterval): Promise<number> {
    return await db.repoTopEvents.getTopIdsCount({
        category: query.cat,
        interval: range,
        oblasti: getOblasti(ctx, query),
    })
}

export async function prepareSessionStateIfNeeded(ctx: ContextMessageUpdate) {
    if (!ctx.scene.current) {
        await ctx.scene.enter('tops_scene', undefined, true)
    }

    const {
        isWatchingEvents,
        isInSubMenu,
        cat,
        submenuSelected,
    } = ctx.session.topsScene || {}

    ctx.session.topsScene = {
        isWatchingEvents: isWatchingEvents || false,
        isInSubMenu: isInSubMenu || false,
        cat: cat,
        submenuSelected,
    }
}

export function analyticsTopParams(stageQuery: TopEventsStageQuery) {
    const rubName = {
        'exhibitions_temp': 'Временные',
        'exhibitions_perm': 'Постояннные',
    }


    if (stageQuery.submenuSelected !== undefined) {
        return {
            dp: `/top/${stageQuery.cat}/${stageQuery.submenuSelected.replace('exhibitions_', '')}/`,
            dt: `Рубрики > ${CAT_NAMES[stageQuery.cat]} > ${rubName[stageQuery.submenuSelected]}`
        }
    } else {
        return {dp: `/top/${stageQuery.cat}/`, dt: `Рубрики > ${CAT_NAMES[stageQuery.cat]}`}
    }
}