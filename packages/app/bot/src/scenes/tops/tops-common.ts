import { CAT_NAMES, ContextMessageUpdate, DateInterval } from '../../interfaces/app-interfaces'
import { EventCategory } from '@culthub/interfaces'
import { getNextWeekendRange } from '../shared/shared-logic'
import { db, LimitOffset } from '../../database/db'
import { encodeTagsLevel1 } from '../../util/tag-level1-encoder'
import { Scenes } from 'telegraf'
import { i18nSceneHelper } from '../../util/scene-helper'

const scene = new Scenes.BaseScene<ContextMessageUpdate>('tops_scene')
const {i18Msg} = i18nSceneHelper(scene)

export type SubMenuVariants = 'exhibitions_temp' | 'exhibitions_perm'

export interface TopEventsStageQuery {
    cat: EventCategory
    submenuSelected?: SubMenuVariants
}

export interface TopsSceneState {
    cat?: EventCategory
    submenuSelected?: SubMenuVariants
    isWatchingEvents: boolean
    isInSubMenu: boolean
}

function getRubrics(ctx: ContextMessageUpdate, query: TopEventsStageQuery) {
    if (query.submenuSelected !== undefined) {
        return encodeTagsLevel1('exhibitions', [i18Msg(ctx, `exhibitions_tags.${query.submenuSelected}`)])
    }
    return []
}

export function getTopRangeInterval(ctx: ContextMessageUpdate): DateInterval {
    return getNextWeekendRange(ctx.now())
}

export async function getTopEventIds(ctx: ContextMessageUpdate, query: TopEventsStageQuery, range: DateInterval, limitOffset: LimitOffset): Promise<number[]> {
    return await db.repoTopEvents.getTopIds({
        category: query.cat,
        interval: range,
        rubrics: getRubrics(ctx, query),
        ...limitOffset,
    })
}

export async function getTopEventCount(ctx: ContextMessageUpdate, query: TopEventsStageQuery, range: DateInterval): Promise<number> {
    return await db.repoTopEvents.getTopIdsCount({
        category: query.cat,
        interval: range,
        rubrics: getRubrics(ctx, query),
    })
}

export async function prepareSessionStateIfNeeded(ctx: ContextMessageUpdate): Promise<TopsSceneState> {
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
    return ctx.session.topsScene
}

export function analyticsTopParams(stageQuery: TopEventsStageQuery): { dt: string; dp: string } {
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