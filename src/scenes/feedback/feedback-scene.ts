import { BaseScene, Extra, Markup, Telegraf } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { i18nSceneHelper, sleep } from '../../util/scene-helper'
import { SceneRegister } from '../../middleware-utils'
import { botConfig } from '../../util/bot-config'
import { db } from '../../db/db'
import { SessionEnforcer } from '../shared/shared-logic'
import { i18n } from '../../util/i18n'

const scene = new BaseScene<ContextMessageUpdate>('feedback_scene');
const {actionName, i18nModuleBtnName, scanKeys} = i18nSceneHelper(scene)

const content = async (ctx: ContextMessageUpdate) => {

    // const adminButtons = [];
    // adminButtons.push([
    //     Markup.callbackButton(i18Btn('sync'), actionName('sync')),
    //     Markup.callbackButton(i18Btn('version'), actionName('version')),
    // ])
    // adminButtons.push([Markup.callbackButton(i18SharedBtn('back'), actionName('back'))])


    const buttons = Markup.keyboard([
        [Markup.button(ctx.i18Btn('take_survey'))],
        [Markup.button(ctx.i18Btn('send_letter'))],
        [Markup.button(ctx.i18Btn('go_back_to_main'))]
    ]).resize()

    return {
        msg: ctx.i18Msg('welcome'),
        markup: Extra.HTML().markup(buttons)
    }
}

const question = (ctx: ContextMessageUpdate, qId: string) => {
    const answers = scanKeys(`keyboard.survey.${qId}`)
    const isBinaryChoose = answers.find(it => it.endsWith('yes')) !== undefined

    const buttons = Markup.keyboard(isBinaryChoose ?
        [
            [Markup.button(i18n.t(`ru`, answers[0])), Markup.button(i18n.t(`ru`, answers[1]))],
            [Markup.button(ctx.i18Btn('go_back_to_main'))]
        ] :
        [
            ...answers.map(answer => {
                return [Markup.button(i18n.t(`ru`, answer))]
            }),
            [Markup.button(ctx.i18Btn('go_back_to_main'))]
        ]
    ).resize()

    return {
        msg: ctx.i18Msg(`survey.${qId}`),
        markup: Extra.HTML().markup(buttons)
    }
}

function globalActionsFn(bot: Telegraf<ContextMessageUpdate>) {
    // bot
    // .hears(i18nModuleBtnName('go_back_to_customize'), async (ctx: ContextMessageUpdate) => {
    //     await goBackToCustomize(ctx)
    // })
    // ;

}


scene
    .enter(async (ctx: ContextMessageUpdate) => {
        prepareSessionStateIfNeeded(ctx)

        const {msg, markup} = await content(ctx)
        await ctx.replyWithMarkdown(msg, markup)

        ctx.session.feedbackScene.messagesSent = 0

        ctx.ua.pv({dp: `/feedback/`, dt: `Обратная связь`})
    })
    .use()
    .hears(i18nModuleBtnName('take_survey'), async (ctx: ContextMessageUpdate) => {
        const {msg, markup} = question(ctx, 'q1_found_events')
        await ctx.replyWithMarkdown(msg, markup)
    })
    .hears(i18nModuleBtnName('send_letter'), async (ctx: ContextMessageUpdate) => {
        prepareSessionStateIfNeeded(ctx)
        ctx.session.feedbackScene.isListening = true

        await ctx.replyWithHTML(ctx.i18Msg('send_letter_welcome'))
    })
    .action(actionName('show_filtered_events'), async (ctx: ContextMessageUpdate) => {
        await ctx.answerCbQuery()
        // await showNextPortionOfResults(ctx)
    })
    .hears(i18nModuleBtnName('go_back_to_main'), async (ctx: ContextMessageUpdate) => {
        await ctx.scene.enter('main_scene')
    })
    .hears(/^[^/].*$/, async (ctx: ContextMessageUpdate) => {
        await sendFeedbackToOurGroup(ctx)
    })
    .on(['voice', 'sticker', 'document', 'photo', 'animation'], async (ctx: ContextMessageUpdate, next: () => Promise<void>) => {
        await sendFeedbackToOurGroup(ctx)
    })

function formatUserName(ctx: ContextMessageUpdate) {
    const from = ctx.from

    const result: string[] = []
    if (from.first_name) {
        result.push(from.first_name)
    }
    if (from.last_name) {
        result.push(from.last_name)
    }
    if (from.username) {
        result.push(`@${from.username}`)
    }
    if (result.length === 0) {
        result.push(`Аноним (id=${ctx.from.id})`)
    }

    return result.join(' ')
}

async function sendFeedbackToOurGroup(ctx: ContextMessageUpdate) {
    if (botConfig.SUPPORT_FEEDBACK_CHAT_ID !== undefined) {

        const tplData = {
            userId: ctx.session.userId,
            user: formatUserName(ctx),
            text: ctx.message.text,
            clickCount: ctx.session.analytics.markupClicks + ctx.session.analytics.inlineClicks,
            uaUuid: ctx.session.uaUuid
        }

        if (ctx.message.text !== undefined) {
            const template = ctx.i18Msg('admin_feedback_template_text', tplData)
            await ctx.telegram.sendMessage(botConfig.SUPPORT_FEEDBACK_CHAT_ID, template, Extra.HTML().markup(undefined))
        } else {
            const template = ctx.i18Msg('admin_feedback_template_other', tplData)
            await ctx.telegram.sendMessage(botConfig.SUPPORT_FEEDBACK_CHAT_ID, template, Extra.HTML().markup(undefined))
            await ctx.telegram.forwardMessage(botConfig.SUPPORT_FEEDBACK_CHAT_ID, ctx.chat.id, ctx.message.message_id)
        }

        await db.repoFeedback.saveFeedback({
            userId: ctx.session.userId,
            feedbackText: ctx.message.text || 'other media: ' + JSON.stringify(ctx.message)
        })

        if (ctx.session.feedbackScene.messagesSent === 0) {
            await ctx.reply(ctx.i18Msg('thank_you_for_custom_feedback'))
            await ctx.replyWithSticker(ctx.i18Msg('sticker_thank_you'))
        } else {
            if (ctx.session.feedbackScene.messagesSent % 5 === 0) {
                const messageSticker = await ctx.replyWithSticker(ctx.i18Msg('sticker_stop_it'))
                await sleep(1000)
                await ctx.deleteMessage(messageSticker.message_id)
            }
            await ctx.reply(ctx.i18Msg('your_feedback_was_amended'))
        }
        ctx.session.feedbackScene.messagesSent++

    } else {
        console.log(`ERROR: SUPPORT_FEEDBACK_CHAT_ID IS NULL, But we have message: '${ctx.message.text}'`)
    }
}


function prepareSessionStateIfNeeded(ctx: ContextMessageUpdate) {
    const {
        messagesSent,
        isListening,
    } = ctx.session.feedbackScene || {}

    ctx.session.feedbackScene = {
        messagesSent: SessionEnforcer.number(messagesSent, 0),
        isListening: isListening || false
    }
}

export const feedbackScene = {
    scene,
    globalActionsFn
} as SceneRegister

export interface FeedbackSceneState {
    isListening: boolean
    messagesSent: number
    // time: string[]
    // openedMenus: string[]
    // cennosti: TagLevel2[]
    // oblasti: string[]
    // format: string[]
    // eventsCounterMsgId?: number
    // eventsCounterMsgText: string
    // resultsFound: number
}
