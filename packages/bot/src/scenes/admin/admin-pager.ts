import { getButtonsSwitch, getSearchedEvents, POSTS_PER_PAGE_ADMIN } from './admin-common'
import { AdminSceneQueryState } from './admin-scene'
import { CardOptions } from '../shared/card-format'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { i18nSceneHelper } from '../../util/scene-helper'
import { PagingConfig } from '../shared/paging-pager'
import { db, LimitOffset } from '../../database/db'

import { AdminEvent } from '../../database/db-admin'
import { Scenes } from 'telegraf'
import { InlineKeyboardButton } from 'telegraf/typings/telegram-types'

const scene = new Scenes.BaseScene<ContextMessageUpdate>('admin_scene')
const {sceneHelper, i18nSharedBtnName, actionName, i18Btn, i18Msg, i18SharedMsg, backButton} = i18nSceneHelper(scene)


export class AdminPager implements PagingConfig<AdminSceneQueryState, AdminEvent> {
    readonly limit = POSTS_PER_PAGE_ADMIN
    readonly sceneId = scene.id

    async getTotal(ctx: ContextMessageUpdate, query: AdminSceneQueryState): Promise<number> {
        const {total} = await getSearchedEvents(ctx, query, {offset: 0, limit: 0})
        return total
    }

    async loadCardsByIds(ctx: ContextMessageUpdate, eventIds: number[]): Promise<AdminEvent[]> {
        return await db.repoAdmin.getAdminEventsByIds(eventIds)
    }

    async preloadIds(ctx: ContextMessageUpdate, limitOffset: LimitOffset, query: AdminSceneQueryState): Promise<number[]> {
        const {events} = await getSearchedEvents(ctx, query, limitOffset)
        return events.map(e => e.id)
    }

    cardFormatOptions(ctx: ContextMessageUpdate, event: AdminEvent): Omit<CardOptions, 'now'> {
        return {
            showAdminInfo: true
        }
    }

    async cardButtons(ctx: ContextMessageUpdate, event: AdminEvent): Promise<InlineKeyboardButton.CallbackButton[]> {
        if (event.snapshotStatus === 'updated') {
            return getButtonsSwitch(ctx, event.extId, 'current')
        }
        return []
    }

    // async onLastEvent(ctx: ContextMessageUpdate) {
    //     await ctx.replyWithHTML(i18Msg(ctx, 'last_event'), {
    //         reply_markup: Markup.inlineKeyboard([[
    //            Markup.button.callback(i18Btn(ctx, 'back_to_main').reply_markup, actionName('back_to_main'))
    //         ]])
    //     })
    // }
}