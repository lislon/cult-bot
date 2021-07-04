import { Composer } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { SceneRegister } from '../../middleware-utils'
import { findPackById, getPacksList, resetPacksCache, scene } from './packs-common'
import { getMsgId, replyWithBackToMainMarkup, warnAdminIfDateIsOverriden } from '../shared/shared-logic'
import { SliderPager } from '../shared/slider-pager'
import { PackEventPagerConfig } from './pack-event-pager-config'
import { displayMainMenu, displayPackMenu } from './packs-menu'
import { i18nSceneHelper } from '../../util/scene-helper'

const {sceneHelper, actionName, i18nModuleBtnName, i18Btn, i18Msg, backButton} = i18nSceneHelper(scene)

const slider = new SliderPager(new PackEventPagerConfig())

// ctx.session.packsScene.msgId = undefined
scene
    .enter(async ctx => {
        await warnAdminIfDateIsOverriden(ctx)

        await replyWithBackToMainMarkup(ctx)
        await displayMainMenu(ctx, {
            forceNewMsg: true
        })
    })
    .leave(async (ctx) => {
        ctx.session.packsScene = undefined
    })
    .use(slider.middleware())
    .action(/packs_scene[.]pack_back/, async ctx => {
        await displayMainMenu(ctx)
    })
    .action(/^packs_scene[.]pack_(\d+)$/, async ctx => {
        await ctx.answerCbQuery()
        ctx.session.packsScene.selectedPackId = +ctx.match[1]
        await displayPackMenu(ctx)
    })
    .action(/^packs_scene.pack_open_(\d+)$/, async ctx => {
        await ctx.answerCbQuery()
        const packId = +ctx.match[1]
        const state = await slider.updateState(ctx, {state: packId, msgId: getMsgId(ctx)})

        await slider.showOrUpdateSlider(ctx, state)
    })
    .action('packs_scene.event_back', async ctx => {
        await ctx.answerCbQuery()
        await displayPackMenu(ctx)
    })
    .action(actionName('event_curr'), async ctx => {
        await ctx.answerCbQuery(i18Msg(ctx, 'event_curr_tip'))
    })

function postStageActionsFn(bot: Composer<ContextMessageUpdate>): void {
    bot
        .action(/packs_scene.direct_menu/, async (ctx) => {
            await ctx.answerCbQuery()
            await displayMainMenu(ctx, {forceNewMsg: true})
        })
        .action(/packs_scene.direct_(\d+)/, async (ctx) => {
            await ctx.answerCbQuery()
            resetPacksCache(ctx)
            const packs = await getPacksList(ctx)
            await ctx.scene.enter('packs_scene', {}, true)

            const directPackId = +ctx.match[1]
            ctx.session.packsScene.selectedPackId = findPackById(packs, directPackId)?.id
            if (ctx.session.packsScene.selectedPackId === undefined) {
                await ctx.replyWithHTML(i18Msg(ctx, 'direct_not_available'))
            }
            await displayPackMenu(ctx, {forceNewMsg: true})
        })
}

export const packsScene: SceneRegister = {
    scene,
    postStageActionsFn
}