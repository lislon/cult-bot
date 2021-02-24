import { SpreadSheetValidationError } from '../../dbsync/parserSpresdsheetEvents'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { db, LimitOffset } from '../../database/db'
import { getNextWeekendRange } from '../shared/shared-logic'
import { StatByCat } from '../../database/db-admin'
import { AdminSceneQueryState } from './admin-scene'
import { Markup, Scenes } from 'telegraf'
import { i18nSceneHelper } from '../../util/scene-helper'

export const POSTS_PER_PAGE_ADMIN = 10

export const SYNC_CONFIRM_TIMEOUT_SECONDS = 60 * 3
export const menuCats = [
    ['theaters', 'exhibitions'],
    ['movies', 'events'],
    ['walks', 'concerts']
]

const scene = new Scenes.BaseScene<ContextMessageUpdate>('admin_scene')
const {sceneHelper, i18nSharedBtnName, actionName, i18Btn, i18Msg, i18SharedMsg, backButton} = i18nSceneHelper(scene)

export function countEventValidationErrors(errors: SpreadSheetValidationError[]) {
    return errors.reduce((total, e) => total + e.extIds.length, 0)
}

export async function getSearchedEvents(ctx: ContextMessageUpdate, query: AdminSceneQueryState, {limit, offset}: LimitOffset) {
    const nextWeekEndRange = getNextWeekendRange(ctx.now())
    if (query.cat !== undefined) {
        const stats: StatByCat[] = await db.repoAdmin.findChangedEventsByCatStats(nextWeekEndRange)
        const total = +stats.find(r => r.category === query.cat)?.count || 0
        const events = await db.repoAdmin.findAllChangedEventsByCat(query.cat, nextWeekEndRange, limit, offset)
        return {total, events}
    } else {
        const stats = await db.repoAdmin.findStatsByReviewer(nextWeekEndRange)
        const total = +stats.find(r => r.reviewer === query.reviewer)?.count || 0
        const events = await db.repoAdmin.findAllEventsByReviewer(query.reviewer, nextWeekEndRange, limit, offset)
        return {total, events}
    }
}

export function getButtonsSwitch(ctx: ContextMessageUpdate, extId: string, active: 'snapshot' | 'current' = 'current') {
    return [Markup.button.callback(
        i18Btn(ctx, `switch_to_snapshot`,
            {active_icon: active === 'snapshot' ? i18Btn(ctx, 'snapshot_active_icon') : ''}
        ),
        actionName(`snapshot_${extId.toLowerCase()}`)),
        Markup.button.callback(
            i18Btn(ctx, 'switch_to_current',
                {active_icon: active === 'current' ? i18Btn(ctx, 'current_active_icon') : ''}
            ),
            actionName(`current_${extId.toLowerCase()}`))
    ]
}