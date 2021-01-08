import { ContextMessageUpdate, EventFormat, MyInterval } from '../../interfaces/app-interfaces'
import { Paging } from '../shared/paging'
import { getNextWeekendRange, SessionEnforcer } from '../shared/shared-logic'
import { mapUserInputToTimeIntervals } from './customize-utils'
import { cleanOblastiTag } from './filters/customize-oblasti'

export function prepareSessionStateIfNeeded(ctx: ContextMessageUpdate) {
    Paging.prepareSession(ctx)

    const {
        openedMenus,
        cennosti,
        time,
        resultsFound,
        eventsCounterMsgId,
        eventsCounterMsgText,
        oblasti,
        format,
        currentStage,
        prevStage
    } = ctx.session.customize || {}

    ctx.session.customize = {
        openedMenus: SessionEnforcer.array(openedMenus),
        cennosti: SessionEnforcer.array(cennosti),
        oblasti: SessionEnforcer.array(oblasti),
        time: SessionEnforcer.array(time),
        format: SessionEnforcer.array(format),
        eventsCounterMsgText,
        currentStage: currentStage || 'root',
        prevStage,
        resultsFound: SessionEnforcer.number(resultsFound),

        eventsCounterMsgId: SessionEnforcer.number(eventsCounterMsgId),
    }
}

export function getNextWeekendRangeForCustom(now: Date): MyInterval {
    return getNextWeekendRange(now, '2weekends_only')
}

export function prepareRepositoryQuery(ctx: ContextMessageUpdate) {
    function mapFormatToDbQuery(format: string[]) {
        if (format === undefined || format.length !== 1) {
            return undefined
        }
        return format[0] as EventFormat
    }

    return {
        timeIntervals: mapUserInputToTimeIntervals(ctx.session.customize.time, getNextWeekendRangeForCustom(ctx.now())),
        weekendRange: getNextWeekendRangeForCustom(ctx.now()),
        cennosti: ctx.session.customize.cennosti,
        oblasti: cleanOblastiTag(ctx),
        format: mapFormatToDbQuery(ctx.session.customize.format)
    }
}