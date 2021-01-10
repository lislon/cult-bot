import { getButtonsSwitch, getSearchedEvents, POSTS_PER_PAGE_ADMIN } from './admin-common'
import { AdminSceneQueryState } from './admin-scene'
import { CardOptions } from '../shared/card-format'
import { BaseScene } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { i18nSceneHelper } from '../../util/scene-helper'
import { PagingConfig } from '../shared/paging-pager'
import { db, LimitOffset } from '../../database/db'
import { CallbackButton } from 'telegraf/typings/markup'
import { EventWithOldVersion } from '../../database/db-admin'

const scene = new BaseScene<ContextMessageUpdate>('admin_scene')
const {sceneHelper, i18nSharedBtnName, actionName, i18Btn, i18Msg, i18SharedMsg, backButton} = i18nSceneHelper(scene)


export class AdminPager implements PagingConfig<AdminSceneQueryState, EventWithOldVersion> {
    readonly limit = POSTS_PER_PAGE_ADMIN
    readonly sceneId = scene.id

    async getTotal(ctx: ContextMessageUpdate, query: AdminSceneQueryState): Promise<number> {
        const {total} = await getSearchedEvents(ctx, query, {offset: 0, limit: 0})
        return total
    }

    async loadCardsByIds(ctx: ContextMessageUpdate, eventIds: number[]): Promise<EventWithOldVersion[]> {
        return await db.repoAdmin.getAdminEventsByIds(eventIds)
    }

    async preloadIds(ctx: ContextMessageUpdate, query: AdminSceneQueryState, limitOffset: LimitOffset): Promise<number[]> {
        const {events} = await getSearchedEvents(ctx, query, limitOffset)
        return events.map(e => e.id)
    }

    cardFormatOptions(ctx: ContextMessageUpdate, event: EventWithOldVersion): CardOptions {
        return {
            showAdminInfo: true
        }
    }

    async cardButtons(ctx: ContextMessageUpdate, event: EventWithOldVersion): Promise<CallbackButton[]> {
        if (event.snapshotStatus === 'updated') {
            return getButtonsSwitch(ctx, event.ext_id, 'current')
        }
        return []
    }

    // async onLastEvent(ctx: ContextMessageUpdate) {
    //     await ctx.replyWithHTML(i18Msg(ctx, 'last_event'), {
    //         reply_markup: Markup.inlineKeyboard([[
    //             Markup.callbackButton(i18Btn(ctx, 'back_to_main'), actionName('back_to_main'))
    //         ]])
    //     })
    // }
}