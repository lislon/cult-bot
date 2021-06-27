import { SpreadSheetValidationError } from '../../dbsync/parserSpresdsheetEvents'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { db, LimitOffset } from '../../database/db'
import { getNextWeekendRange } from '../shared/shared-logic'
import { AdminEvent, StatByCat } from '../../database/db-admin'
import { AdminSceneQueryState } from './admin-scene'
import { Markup, Scenes } from 'telegraf'
import { i18nSceneHelper } from '../../util/scene-helper'
import { InlineKeyboardButton, User } from 'typegram'

export const POSTS_PER_PAGE_ADMIN = 10

export const SYNC_CONFIRM_TIMEOUT_SECONDS = 60 * 3
export const menuCats = [
    ['theaters', 'exhibitions'],
    ['movies', 'events'],
    ['walks', 'concerts']
]

const scene = new Scenes.BaseScene<ContextMessageUpdate>('admin_scene')
const {actionName, i18Btn} = i18nSceneHelper(scene)

export function countEventValidationErrors(errors: SpreadSheetValidationError[]): number {
    return errors.reduce((total, e) => total + e.extIds.length, 0)
}

export async function getSearchedEvents(ctx: ContextMessageUpdate, query: AdminSceneQueryState, {limit, offset}: LimitOffset): Promise<{ total: number; events: AdminEvent[] }> {
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

export function getButtonsSwitch(ctx: ContextMessageUpdate, extId: string, active: 'snapshot' | 'current' = 'current'): (InlineKeyboardButton.CallbackButton & { hide: boolean })[] {
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

export function getHumanReadableUsername(user: User): string {
    return user.first_name || user.last_name || user.username || user.id + ''
}

export function getUserFromCtx(ctx: ContextMessageUpdate): User {
    if ('message' in ctx.update) {
        return ctx.update.message.from
    } else if ('callback_query' in ctx.update) {
        return ctx.update.callback_query.from
    } else {
        return {
            id: 0,
            username: 'unknown',
            last_name: '',
            first_name: '',
            language_code: 'ru',
            is_bot: false
        }
    }
}