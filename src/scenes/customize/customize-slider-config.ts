import { CurrentPage } from '../shared/events-pager'
import { ContextMessageUpdate, Event } from '../../interfaces/app-interfaces'
import { CallbackButton } from 'telegraf/typings/markup'
import { BaseScene, Markup } from 'telegraf'
import { SliderConfig } from '../shared/events-slider'
import { i18nSceneHelper } from '../../util/scene-helper'
import { prepareRepositoryQuery, prepareSessionStateIfNeeded } from './customize-common'
import { db } from '../../database/db'

const scene = new BaseScene<ContextMessageUpdate>('customize_scene')
const {backButton, actionName, i18nModuleBtnName, revertActionName, scanKeys, i18nSharedBtnName, i18Btn, i18Msg, i18SharedBtn} = i18nSceneHelper(scene)


export class CustomizeSliderConfig implements SliderConfig {
    async newQuery(ctx: ContextMessageUpdate): Promise<void> {
        prepareSessionStateIfNeeded(ctx)
        ctx.session.customize.filteredEventsSnapshot = await db.repoCustomEvents.findEventIdsCustomFilter({
            ...prepareRepositoryQuery(ctx),
        })
    }

    async nextPortion(ctx: ContextMessageUpdate, {limit, offset}: CurrentPage): Promise<Event[]> {
        const eventIds = ctx.session.customize.filteredEventsSnapshot.slice(offset, offset + limit)
        return await db.repoEventsCommon.getEventsByIds(eventIds)
    }

    async getTotal(ctx: ContextMessageUpdate): Promise<number> {
        return ctx.session.customize.filteredEventsSnapshot.length
    }

    public async backButtons(ctx: ContextMessageUpdate): Promise<CallbackButton[][]> {
        return [
            [
                Markup.callbackButton(i18Btn(ctx, 'event_back'), actionName(`event_back`))
            ]
        ]
    }

    analytics(ctx: ContextMessageUpdate, events: Event[], {limit, offset}: CurrentPage) {
        // const pageNumber = Math.floor(limit / offset) + 1
        //
        // const pageTitle = pageNumber > 1 ? ` [Страница ${pageNumber}]` : ''
        // ctx.ua.pv({
        //     dp: `/favorites/${pageNumber > 1 ? `p${pageNumber}/` : ''}`,
        //     dt: `Избранное > Актуальные карточки ${pageTitle}`.trim()
        // })
    }
}
