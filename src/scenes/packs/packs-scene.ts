import { Composer } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { i18nSceneHelper } from '../../util/scene-helper'
import { i18n } from '../../util/i18n'
import { SceneRegister } from '../../middleware-utils'
import { displayEventsMenu, displayMainMenu, displayPackMenu } from './packs-menu'
import { getEventsCount, getPacksList, prepareSessionStateIfNeeded, scene } from './packs-common'
import { logger } from '../../util/logger'
import { replyDecoyNoButtons, warnAdminIfDateIsOverriden } from '../shared/shared-logic'

const {sceneHelper, actionName, i18nModuleBtnName, i18Btn, i18Msg, backButton} = i18nSceneHelper(scene)

function loop(index: number | undefined, count: number, dir: string) {
    return (count + (index === undefined ? 0 : index) + (dir === 'prev' ? -1 : 1)) % count
}

function doNotUpdateInlineMenu(ctx: ContextMessageUpdate) {
    ctx.session.packsScene.msgId = undefined
}

scene
    .enter(async (ctx: ContextMessageUpdate) => {
        await warnAdminIfDateIsOverriden(ctx)

        await replyDecoyNoButtons(ctx)
        await displayMainMenu(ctx)
    })
    .leave(async (ctx) => {
        ctx.session.packsScene = undefined
    })
    .action(/packs_scene[.]pack_back/, async (ctx: ContextMessageUpdate) => {
        await displayMainMenu(ctx)
    })
    .action(/^packs_scene[.]pack_(\d+)$/, async (ctx: ContextMessageUpdate) => {
        await ctx.answerCbQuery()
        ctx.session.packsScene.packSelectedIdx = +ctx.match[1]
        await displayPackMenu(ctx)
    })
    .action('packs_scene.pack_open', async (ctx: ContextMessageUpdate) => {
        await ctx.answerCbQuery()
        await displayEventsMenu(ctx)
    })
    .action(/^packs_scene[.]event_(prev|next)$/, async (ctx: ContextMessageUpdate) => {
        await ctx.answerCbQuery()
        if (await getEventsCount(ctx) !== 1) {
            const c = loop(
                ctx.session.packsScene.eventSelectedIdx, await getEventsCount(ctx), ctx.match[1]
            )
            ctx.session.packsScene.eventSelectedIdx = c
            await displayEventsMenu(ctx)
        }
    })
    .action('packs_scene.event_back', async (ctx: ContextMessageUpdate) => {
        await ctx.answerCbQuery()
        await displayPackMenu(ctx)
    })
    .action(actionName('event_curr_tip'), async (ctx: ContextMessageUpdate) => {
        await ctx.answerCbQuery(i18Msg(ctx, 'event_curr_tip'))
    })
    .hears(i18n.t(`ru`, `shared.keyboard.back`), async (ctx: ContextMessageUpdate) => {
        await prepareSessionStateIfNeeded(ctx)
        doNotUpdateInlineMenu(ctx)
        try {
            if (ctx.session.packsScene.packSelectedIdx === undefined) {
                await ctx.scene.enter('main_scene')
            } else if (ctx.session.packsScene.eventSelectedIdx === undefined) {
                await displayMainMenu(ctx)
            } else {
                await displayPackMenu(ctx)
            }
        } catch (e) {
            logger.warn(e)
            await ctx.scene.enter('main_scene')
        }
    })

function postStageActionsFn(bot: Composer<ContextMessageUpdate>) {
    bot
        .action(/packs_scene.direct_menu/, async (ctx) => {
            await ctx.answerCbQuery()
            await displayMainMenu(ctx)
        })
        .action(/packs_scene.direct_(\d+)/, async (ctx) => {
            await ctx.answerCbQuery()
            const packs = await getPacksList(ctx)
            await ctx.scene.enter('packs_scene', {}, true)

            doNotUpdateInlineMenu(ctx)
            const directPackId = +ctx.match[1]
            ctx.session.packsScene.packSelectedIdx = packs.findIndex(p => p.id === directPackId)
            if (ctx.session.packsScene.packSelectedIdx === -1) {
                await ctx.replyWithHTML(i18Msg(ctx, 'direct_not_available'))
                await displayMainMenu(ctx)
            } else {
                await displayPackMenu(ctx)
            }
        })
}

export const packsScene = {
    scene,
    postStageActionsFn
} as SceneRegister