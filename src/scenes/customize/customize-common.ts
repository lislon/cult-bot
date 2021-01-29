import { ContextMessageUpdate, EventFormat, MyInterval, TagLevel2 } from '../../interfaces/app-interfaces'
import { getNextWeekendRange, SessionEnforcer } from '../shared/shared-logic'
import { mapUserInputToTimeIntervals } from './customize-utils'
import { cleanRubricsTag } from './filters/customize-rubrics'

export type StageType = 'root' | 'time' | 'rubrics' | 'priorities' | 'format' | 'results'

export interface CustomizeFilters {
    format: string[]
    priorities: TagLevel2[]
    rubrics: string[]
    time: string[]
}

export interface CustomizeSceneState extends CustomizeFilters {
    openedMenus: string[]
    resultsFound?: number
    currentStage: StageType
    prevStage?: StageType
}

export function prepareSessionStateIfNeeded(ctx: ContextMessageUpdate) {
    const {
        openedMenus,
        priorities,
        time,
        resultsFound,
        oblasti,
        cennosti,
        rubrics,
        format,
        currentStage,
        prevStage
    } = (ctx.session.customize || {}) as (CustomizeSceneState & { oblasti: string; cennosti: string })

    ctx.session.customize = {
        openedMenus: SessionEnforcer.array(openedMenus),
        priorities: SessionEnforcer.array(priorities || cennosti).filter(s => s !== '#ЗОЖ') as TagLevel2[],
        rubrics: SessionEnforcer.array(rubrics || oblasti),
        time: SessionEnforcer.array(time),
        format: SessionEnforcer.array(format),
        currentStage: currentStage || 'root',
        resultsFound: SessionEnforcer.number(resultsFound),
        prevStage,
    }
}

export function getNextWeekendRangeForCustom(now: Date): MyInterval {
    return getNextWeekendRange(now, '2weekends_only')
}

export function prepareRepositoryQuery(ctx: ContextMessageUpdate, filters: CustomizeFilters) {
    function mapFormatToDbQuery(format: string[]) {
        if (format === undefined || format.length !== 1) {
            return undefined
        }
        return format[0] as EventFormat
    }

    return {
        timeIntervals: mapUserInputToTimeIntervals(filters.time, getNextWeekendRangeForCustom(ctx.now())),
        weekendRange: getNextWeekendRangeForCustom(ctx.now()),
        priorities: filters.priorities,
        rubrics: cleanRubricsTag(filters.rubrics),
        format: mapFormatToDbQuery(filters.format)
    }
}