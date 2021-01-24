import { ContextMessageUpdate, EventFormat, MyInterval, TagLevel2 } from '../../interfaces/app-interfaces'
import { getNextWeekendRange, SessionEnforcer } from '../shared/shared-logic'
import { mapUserInputToTimeIntervals } from './customize-utils'
import { cleanOblastiTag } from './filters/customize-oblasti'

export type StageType = 'root' | 'time' | 'oblasti' | 'priorities' | 'format' | 'results'

export interface CustomizeFilters {
    format: string[]
    cennosti: TagLevel2[]
    oblasti: string[]
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
        cennosti,
        time,
        resultsFound,
        oblasti,
        format,
        currentStage,
        prevStage
    } = ctx.session.customize || {}

    ctx.session.customize = {
        openedMenus: SessionEnforcer.array(openedMenus),
        cennosti: SessionEnforcer.array(cennosti).filter(s => s !== '#ЗОЖ') as TagLevel2[],
        oblasti: SessionEnforcer.array(oblasti),
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
        cennosti: filters.cennosti,
        oblasti: cleanOblastiTag(filters.oblasti),
        format: mapFormatToDbQuery(filters.format)
    }
}