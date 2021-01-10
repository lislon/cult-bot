import { BaseScene, Composer } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { i18nSceneHelper } from '../../util/scene-helper'
import { replyWithBackToMainMarkup, warnAdminIfDateIsOverriden } from '../shared/shared-logic'
import { SceneRegister } from '../../middleware-utils'
import { PagingPager } from '../shared/paging-pager'
import emojiRegex from 'emoji-regex'
import { SearchPagerConfig } from './search-pager'

const scene = new BaseScene<ContextMessageUpdate>('search_scene')
const {sceneHelper, i18nSharedBtnName, actionName, i18Btn, i18Msg, i18SharedMsg, backButton} = i18nSceneHelper(scene)

export interface SearchSceneState {
    request: string
}

async function prepareSessionStateIfNeeded(ctx: ContextMessageUpdate) {
    if (!ctx.scene.current) {
        await ctx.scene.enter('search_scene', undefined, true)
    }
    if (ctx.session.search === undefined) {
        ctx.session.search = {
            request: undefined
        }
    }
}

const eventPager = new PagingPager(new SearchPagerConfig())

scene
    .enter(async (ctx: ContextMessageUpdate) => {
        await prepareSessionStateIfNeeded(ctx)
        await replyWithBackToMainMarkup(ctx, i18Msg(ctx, 'please_search'))

        ctx.ua.pv({dp: `/search/`, dt: `Поиск`})
    })
    .leave(async (ctx: ContextMessageUpdate) => {
        ctx.session.search = undefined
    })
    .use(eventPager.middleware())
    .hears(/^[^/].*$/, async (ctx, next) => {
        if (ctx.match[0].match(emojiRegex())) {
            await next()
            return
        }
        ctx.session.search.request = ctx.match[0]
        await warnAdminIfDateIsOverriden(ctx)
        await eventPager.updateState(ctx, ctx.session.search.request)
        await eventPager.initialShowCards(ctx)
    })

function postStageActionsFn(bot: Composer<ContextMessageUpdate>) {
    bot
        .action(actionName('back_to_main'), async (ctx) => {
            await ctx.answerCbQuery()
            await ctx.scene.enter('main_scene')
        })
}


export const searchScene = {
    scene,
    postStageActionsFn
} as SceneRegister