import Telegraf, { BaseScene, Extra, Markup } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { i18nSceneHelper, ifAdmin, isAdmin } from '../../util/scene-helper'
import TelegrafI18n from 'telegraf-i18n'

const scene = new BaseScene<ContextMessageUpdate>('main_scene');

const {sceneHelper, actionName, i18nModuleBtnName} = i18nSceneHelper(scene)

const content = (ctx: ContextMessageUpdate) => {

    const {i18Btn, i18Msg} = sceneHelper(ctx)

    const menu = [
        ['packs'],
        ['customize'],
        ['search'],
        ...[(isAdmin(ctx) ? ['admin'] : [])]
    ]

    const mainButtons = menu.map(row =>
        row.map(btnName => {
            return Markup.button(i18Btn(btnName));
        })
    );

    return {
        msg: i18Msg('select_anything'),
        markupMainMenu: Extra.HTML(true).markup(Markup.keyboard(mainButtons).resize())
    }
}

scene.enter(async (ctx: ContextMessageUpdate) => {
    console.log('enter scene main_scene')
    const {msg, markupMainMenu} = content(ctx)

    await ctx.replyWithMarkdown(msg, markupMainMenu)
})

scene.leave(async (ctx: ContextMessageUpdate) => {
    console.log('exit scene main_scene')
})

function registerActions(bot: Telegraf<ContextMessageUpdate>, i18n: TelegrafI18n) {
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
        .hears(i18nModuleBtnName('admin'), async (ctx: ContextMessageUpdate) => {
            await ifAdmin(ctx, () => ctx.scene.enter('admin_scene'))
        });
}

export {
    scene as mainScene,
    registerActions as mainRegisterActions
}