import { Composer, Scenes } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { i18nSceneHelper } from '../../util/scene-helper'
import { backToMainButtonTitle, replyWithBackToMainMarkup, warnAdminIfDateIsOverriden } from '../shared/shared-logic'
import { SceneRegister } from '../../middleware-utils'
import emojiRegex from 'emoji-regex'
import { SearchPagerConfig } from './search-pager'
import { SliderPager } from '../shared/slider-pager'

const scene = new Scenes.BaseScene<ContextMessageUpdate>('search_scene')
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

const eventSlider = new SliderPager(new SearchPagerConfig())

scene
    .enter(async ctx => {
        await prepareSessionStateIfNeeded(ctx)
        await replyWithBackToMainMarkup(ctx, i18Msg(ctx, 'please_search'))

        ctx.ua.pv({dp: `/search/`, dt: `Поиск`})
    })
    .leave(async ctx => {
        ctx.session.search = undefined
    })
    .use(eventSlider.middleware())
    .hears(backToMainButtonTitle().trim(), async (ctx) => {
        await ctx.scene.enter('main_scene')
    })
    .hears(/^[^/].*$/, async (ctx, next) => {
        if (ctx.match[0].match(emojiRegex())) {
            await next()
            return
        }
        ctx.session.search.request = ctx.match[0]
        await warnAdminIfDateIsOverriden(ctx)
        const state = await eventSlider.updateState(ctx, {state: ctx.session.search.request})
        if (state.total > 0) {
            await ctx.replyWithHTML(i18Msg(ctx, 'here_your_results', {
                query: ctx.session.search.request
            }))
            await eventSlider.showOrUpdateSlider(ctx, state, {
                forceNewMsg: true
            })
        } else {
            await ctx.replyWithHTML(i18Msg(ctx, 'no_results'))
        }
    })

function postStageActionsFn(bot: Composer<ContextMessageUpdate>) {
    bot
        .action(actionName('back'), async (ctx) => {
            await ctx.answerCbQuery()
            await ctx.scene.enter('main_scene')
        })
}


export const searchScene : SceneRegister = {
    scene,
    postStageActionsFn
}