import { BaseScene, Composer, Extra, Markup } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { i18nSceneHelper, ifAdmin, isAdmin } from '../../util/scene-helper'
import { SceneRegister } from '../../middleware-utils'
import { botConfig } from '../../util/bot-config'

const scene = new BaseScene<ContextMessageUpdate>('main_scene');

const {i18nModuleBtnName, i18Btn, i18Msg} = i18nSceneHelper(scene)

function isTimeToShowFeedback(ctx: ContextMessageUpdate) {
    return botConfig.SUPPORT_FEEDBACK_CHAT_ID !== undefined &&
        ((ctx.session.analytics.inlineClicks + ctx.session.analytics.markupClicks > 25) || isAdmin(ctx))
}

const content = (ctx: ContextMessageUpdate) => {
    const feedbackBtn = isTimeToShowFeedback(ctx) ? ['feedback'] : []

    const menu = [
        ['customize'],
        ['packs'],
        ['search'],
        ...[(isAdmin(ctx) ? ['admin', ...feedbackBtn] : feedbackBtn)]
    ]

    const mainButtons = menu.map(row =>
        row.map(btnName => {
            return Markup.button(i18Btn(ctx, btnName));
        })
    );

    return {
        msg: i18Msg(ctx, 'select_anything'),
        markupMainMenu: Extra.HTML(true).markup(Markup.keyboard(mainButtons).resize())
    }
}

scene.enter(async (ctx: ContextMessageUpdate) => {
    const {msg, markupMainMenu} = content(ctx)

    await ctx.replyWithMarkdown(msg, markupMainMenu)

    ctx.ua.pv({ dp: '/', dt: 'Главное меню' })
})

function globalActionsFn(bot: Composer<ContextMessageUpdate>) {
    bot
        .hears(i18nModuleBtnName('packs'), async (ctx: ContextMessageUpdate) => {
            await ctx.scene.enter('packs_scene')
        })
        .hears(i18nModuleBtnName('search'), async (ctx: ContextMessageUpdate) => {
            await ctx.scene.enter('search_scene')
        })
        .hears(i18nModuleBtnName('customize'), async (ctx: ContextMessageUpdate) => {
            await ctx.scene.enter('customize_scene')
        })
        .hears(i18nModuleBtnName('feedback'), async (ctx: ContextMessageUpdate) => {
            await ctx.scene.enter('feedback_scene')
        })
        .hears(i18nModuleBtnName('admin'), async (ctx: ContextMessageUpdate) => {
            await ifAdmin(ctx, () => ctx.scene.enter('admin_scene'))
        });
}

export const mainScene = {
    scene,
    globalActionsFn
} as SceneRegister