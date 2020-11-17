import { BaseScene, Extra, Markup, Telegraf } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { i18nSceneHelper } from '../../util/scene-helper'
import TelegrafI18n from 'telegraf-i18n'

const scene = new BaseScene<ContextMessageUpdate>('feedback_scene');

const {backButton, sceneHelper, actionName, i18nModuleBtnName, revertActionName, scanKeys} = i18nSceneHelper(scene)

const content = async (ctx: ContextMessageUpdate) => {
    const {i18Btn, i18Msg, i18SharedBtn} = sceneHelper(ctx)

    // const adminButtons = [];
    // adminButtons.push([
    //     Markup.callbackButton(i18Btn('sync'), actionName('sync')),
    //     Markup.callbackButton(i18Btn('version'), actionName('version')),
    // ])
    // adminButtons.push([Markup.callbackButton(i18SharedBtn('back'), actionName('back'))])


    const buttons = Markup.keyboard([
        [Markup.button(i18Btn('short_feedback'))],
        [Markup.button(i18Btn('send_letter'))],
        [Markup.button(i18Btn('go_back_to_main'))]
    ]).resize()

    return {
        msg: i18Msg('welcome'),
        markup: Extra.HTML().markup(buttons)
    }
}

const question = (ctx: ContextMessageUpdate, templateId: string) => {
    const {i18Btn, i18Msg, i18SharedBtn} = sceneHelper(ctx)
    const buttons = Markup.keyboard([
        [Markup.button(i18Btn('yes')), Markup.button(i18Btn('no'))],
        [Markup.button(i18Btn('go_back_to_main'))]
    ]).resize()

    return {
        msg: i18Msg(templateId),
        markup: Extra.HTML().markup(buttons)
    }
}

function registerActions(bot: Telegraf<ContextMessageUpdate>, i18n: TelegrafI18n) {
    bot
        // .hears(i18nModuleBtnName('go_back_to_customize'), async (ctx: ContextMessageUpdate) => {
        //     await goBackToCustomize(ctx)
        // })
    ;

}


scene
    .enter(async (ctx: ContextMessageUpdate) => {
        prepareSessionStateIfNeeded(ctx)

        const {msg, markup} = await content(ctx)
        await ctx.replyWithMarkdown(msg, markup)

        ctx.ua.pv({dp: `/feedback/`, dt: `Обратная связь`})
    })
    .hears(i18nModuleBtnName('short_feedback'), async (ctx: ContextMessageUpdate) => {
        const {i18Btn, i18Msg, i18SharedBtn} = sceneHelper(ctx)
        const {msg, markup} = question(ctx, 'short_feedback_welcome')
        await ctx.replyWithMarkdown(msg, markup)
    })
    .hears(i18nModuleBtnName('send_letter'), async (ctx: ContextMessageUpdate) => {
        const {i18Btn, i18Msg, i18SharedBtn} = sceneHelper(ctx)
        await ctx.replyWithMarkdown(i18Msg('send_letter_welcome'))

    })
    .action(actionName('show_filtered_events'), async (ctx: ContextMessageUpdate) => {
        await ctx.answerCbQuery()
        // await showNextPortionOfResults(ctx)
    })



function prepareSessionStateIfNeeded(ctx: ContextMessageUpdate) {
    // Paging.prepareSession(ctx)
    //
    // const {
    //     openedMenus,
    //     cennosti,
    //     time,
    //     resultsFound,
    //     eventsCounterMsgId,
    //     eventsCounterMsgText,
    //     oblasti,
    //     format
    // } = ctx.session.customize || {}
    //
    // ctx.session.customize = {
    //     openedMenus: SessionEnforcer.array(openedMenus),
    //     cennosti: SessionEnforcer.array(cennosti),
    //     oblasti: SessionEnforcer.array(oblasti),
    //     time: SessionEnforcer.array(time),
    //     format: SessionEnforcer.array(format),
    //     eventsCounterMsgText,
    //     resultsFound: SessionEnforcer.number(resultsFound),
    //
    //     eventsCounterMsgId: SessionEnforcer.number(eventsCounterMsgId),
    // }
}
export {
    scene as feedbackScene,
    registerActions as customizeFeedbackActions
}

export interface FeedbackSceneState {
    // time: string[]
    // openedMenus: string[]
    // cennosti: TagLevel2[]
    // oblasti: string[]
    // format: string[]
    // eventsCounterMsgId?: number
    // eventsCounterMsgText: string
    // resultsFound: number
}
