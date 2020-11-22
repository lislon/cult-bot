import { BaseScene, Extra, Markup, Telegraf } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { i18nSceneHelper, sleep } from '../../util/scene-helper'
import { SceneRegister } from '../../middleware-utils'
import { botConfig } from '../../util/bot-config'
import { db } from '../../database/db'
import { SessionEnforcer } from '../shared/shared-logic'
import { menuMiddleware } from './survey'
import * as tt from 'telegraf/typings/telegram-types'
import { logger, loggerWithCtx } from '../../util/logger'

const scene = new BaseScene<ContextMessageUpdate>('feedback_scene');
const {actionName, i18nModuleBtnName, scanKeys} = i18nSceneHelper(scene)

function globalActionsFn(bot: Telegraf<ContextMessageUpdate>) {
    // bot
    // .hears(i18nModuleBtnName('go_back_to_customize'), async (ctx: ContextMessageUpdate) => {
    //     await goBackToCustomize(ctx)
    // })
    // ;

}

async function sendFeedbackIfListening(ctx: ContextMessageUpdate) {
    if (ctx.session.feedbackScene.isListening === true) {
        await sendFeedbackToOurGroup(ctx)
    } else {
        await ctx.replyWithHTML(ctx.i18Msg('please_click_write_first', {button: ctx.i18Btn('survey.q_landing.send_letter')}))
    }
}

scene
    .enter(async (ctx: ContextMessageUpdate) => {
        prepareSessionStateIfNeeded(ctx)

        const buttons = Markup.keyboard([
            [Markup.button(ctx.i18Btn('go_back_to_main'))]
        ]).resize()

        await ctx.replyWithMarkdown(ctx.i18Msg('welcome'), Extra.HTML().markup(buttons))
        await menuMiddleware.replyToContext(ctx)
        // await ctx.replyWithMarkdown(ctx.i18Msg('take_survey'), Extra.HTML(true).markup(Markup.inlineKeyboard(
        //     [[Markup.callbackButton(ctx.i18Btn('take_survey'), 'take_survey')],
        //             [Markup.callbackButton(ctx.i18Btn('send_letter'), 'take_survey')]]
        // )))

        ctx.session.feedbackScene.messagesSent = 0
        ctx.session.feedbackScene.surveyDone = false
        ctx.session.feedbackScene.isFound = undefined

        ctx.ua.pv({dp: `/feedback/`, dt: `Обратная связь`})
    })
    .leave((ctx: ContextMessageUpdate) => {
        ctx.session.feedbackScene = undefined
    })
    // .action('take_survey', async (ctx: ContextMessageUpdate) => {
    //     await ctx.answerCbQuery()
    // })
    .action('/found/not_found/',  async (ctx, next) => {
        prepareSessionStateIfNeeded(ctx)
        ctx.session.feedbackScene.isFound = false
        await next()
    })
    .action('/found/your_events/',  async (ctx, next) => {
        prepareSessionStateIfNeeded(ctx)
        ctx.session.feedbackScene.isFound = true
        await next()
    })
    .action([
        '/found/not_found/end_sorry/',
        '/found/your_events/end_nice/',
        '/found/your_events/write_important',
        '/found/not_found/write_not_like',
    ], async (ctx: ContextMessageUpdate, next: () => Promise<void>) => {
        prepareSessionStateIfNeeded(ctx)
        ctx.session.feedbackScene.surveyDone = true
        await db.repoFeedback.saveQuiz({
            what_is_important: ctx.session.feedbackScene.whatImportant.map((r: string) => r.replace(/^opt_/, '')),
            why_not_like: ctx.session.feedbackScene.whyDontLike.map((r: string) => r.replace(/^opt_/, '')),
            isFound: ctx.session.feedbackScene.isFound,
            userId: ctx.session.userId
        })
        await next()
    })
    .use(menuMiddleware)
    .hears(i18nModuleBtnName('go_back_to_main'), async (ctx: ContextMessageUpdate) => {
        await ctx.scene.enter('main_scene')
    })
    .hears(/^[^/].*$/, async (ctx: ContextMessageUpdate) => {
        await sendFeedbackIfListening(ctx)
    })
    .on(['voice', 'sticker', 'document', 'photo', 'animation'], async (ctx: ContextMessageUpdate) => {
        await sendFeedbackIfListening(ctx)
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

        let adminMessage: tt.Message
        if (ctx.message.text !== undefined) {
            const template = ctx.i18Msg('admin_feedback_template_text', tplData)
            adminMessage = await ctx.telegram.sendMessage(botConfig.SUPPORT_FEEDBACK_CHAT_ID, template, Extra.HTML().markup(undefined))
        } else {
            const template = ctx.i18Msg('admin_feedback_template_other', tplData)
            await ctx.telegram.sendMessage(botConfig.SUPPORT_FEEDBACK_CHAT_ID, template, Extra.HTML().markup(undefined))
            adminMessage = await ctx.telegram.forwardMessage(botConfig.SUPPORT_FEEDBACK_CHAT_ID, ctx.chat.id, ctx.message.message_id)
        }

        loggerWithCtx.debug(ctx, 'adminMessage = %s', JSON.stringify(adminMessage, undefined, 2))
        logger.debug('hi')
        await db.repoFeedback.saveFeedback({
            userId: ctx.session.userId,
            messageId: ctx.message.message_id,
            feedbackText: ctx.message.text || 'other media: ' + JSON.stringify(ctx.message),
            adminChatId: botConfig.SUPPORT_FEEDBACK_CHAT_ID,
            adminMessageId: adminMessage.message_id
        })

        if (ctx.session.feedbackScene.messagesSent === 0) {
            await ctx.replyWithHTML(ctx.i18Msg('thank_you_for_custom_feedback'))
            await ctx.replyWithSticker(ctx.i18Msg('sticker_thank_you'))
        } else {
            if (ctx.session.feedbackScene.messagesSent === 5) {
                const messageSticker = await ctx.replyWithSticker(ctx.i18Msg('sticker_stop_it'))
                await sleep(1000)
                await ctx.deleteMessage(messageSticker.message_id)
            }
            await ctx.replyWithHTML(ctx.i18Msg('your_feedback_was_amended'))
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
        whatImportant,
        whyDontLike,
        surveyDone,
        isFound
    } = ctx.session.feedbackScene || {}

    ctx.session.feedbackScene = {
        messagesSent: SessionEnforcer.number(messagesSent, 0),
        isListening: isListening || false,
        surveyDone: surveyDone || false,
        whatImportant: SessionEnforcer.array(whatImportant),
        whyDontLike: SessionEnforcer.array(whyDontLike),
        isFound: isFound
    }
}

export const feedbackScene = {
    scene,
    globalActionsFn
} as SceneRegister

export interface FeedbackSceneState {
    isListening: boolean
    messagesSent: number
    whatImportant: string[]
    whyDontLike: string[]
    isFound?: boolean
    surveyDone: boolean
}
