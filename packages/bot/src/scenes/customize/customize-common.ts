import { ContextMessageUpdate, EventFormat, DateInterval, TagLevel2 } from '../../interfaces/app-interfaces'
import { getNextWeekendRange, SessionEnforcer } from '../shared/shared-logic'
import { mapUserInputToTimeIntervals } from './customize-utils'
import { cleanRubricsTag } from './filters/customize-rubrics'
import { parse } from 'date-fns'

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
        priorities: SessionEnforcer.array(priorities || cennosti) as TagLevel2[],
        rubrics: SessionEnforcer.array(rubrics || oblasti),
        time: SessionEnforcer.array(time),
        format: SessionEnforcer.array(format),
        currentStage: currentStage || 'root',
        resultsFound: SessionEnforcer.number(resultsFound),
        prevStage,
    }
}

export function getNextWeekendRangeForCustom(now: Date): DateInterval {
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

export const MAX_EXPLAIN_LINE_LEN = 35
export const SLOT_DATE_FORMAT = 'yyyy-MM-dd'

export function parseSlot(str: string): { date: Date, startTime: string, endTime: string } {
    const [date, startTime, endTime] = str.split(/\.|-(?=\d\d:\d\d$)/)
    return {date: parse(date, SLOT_DATE_FORMAT, new Date()), startTime, endTime}
}

