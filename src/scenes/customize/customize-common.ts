import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { Paging } from '../shared/paging'
import { SessionEnforcer } from '../shared/shared-logic'

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