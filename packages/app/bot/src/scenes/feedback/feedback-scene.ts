import { Composer, Markup, Scenes } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { findInlineBtnTextByCallbackData, i18nSceneHelper, sleep } from '../../util/scene-helper'
import { SceneRegister } from '../../middleware-utils'
import { botConfig } from '../../util/bot-config'
import { db } from '../../database/db'
import { backToMainButtonTitle, replyWithBackToMainMarkup, SessionEnforcer } from '../shared/shared-logic'
import * as tt from 'typegram'
import { Message } from 'typegram'
import { countInteractions } from '../../lib/middleware/analytics-middleware'
import { formatUserName } from '../../util/misc-utils'
import { last, sortBy } from 'lodash'
import PhotoMessage = Message.PhotoMessage
import { encode } from 'html-entities'

const scene = new Scenes.BaseScene<ContextMessageUpdate>('feedback_scene')
const {actionName, i18nModuleBtnName, scanKeys, i18Btn, i18Msg} = i18nSceneHelper(scene)

scene
    .enter(async ctx => {
        prepareSessionStateIfNeeded(ctx)
        await replyWithBackToMainMarkup(ctx, i18Msg(ctx, 'welcome'))
        ctx.session.feedbackScene.messagesSent = 0

        ctx.ua.pv({dp: `/feedback/`, dt: `Обратная связь`})
    })
    .leave((ctx: ContextMessageUpdate) => {
        ctx.session.feedbackScene = undefined
    })
    .hears(backToMainButtonTitle(), async ctx => {
        await ctx.scene.enter('main_scene')
    })
    .hears(/^[^/]/, async ctx => {
        await sendFeedbackToOurGroup(ctx)
    })
    .on(['voice', 'sticker', 'document', 'photo', 'animation'], async ctx => {
        await sendFeedbackToOurGroup(ctx)
    })

function userSelected(ctx: ContextMessageUpdate, selected: string[], question: 'q_why_not_like' | 'q_what_is_important') {
    const selections = selected
        .map(s => ' - ' + i18Btn(ctx, `survey.${question}.${s}`))
        .join('\n')
    return {selections}
}

function getBasicTemplateForAdminMessage(ctx: ContextMessageUpdate) {
    return {
        userId: ctx.session.user.id,
        user: formatUserName(ctx),
        text: ctx.message && 'text' in ctx.message ? encode(ctx.message.text) : undefined,
        clickCount: countInteractions(ctx),
        uaUuid: ctx.session.user.uaUuid
    }
}


function isPhoto(message: Message): message is PhotoMessage {
    return 'photo' in message
}

async function sendFeedbackToOurGroup(ctx: ContextMessageUpdate) {
    if (botConfig.SUPPORT_FEEDBACK_CHAT_ID !== undefined) {
        const tplData = getBasicTemplateForAdminMessage(ctx)

        let adminMessage: tt.Message
        let feedbackText
        if ('text' in ctx.message) {
            feedbackText = ctx.message.text
            adminMessage = await ctx.telegram.sendMessage(botConfig.SUPPORT_FEEDBACK_CHAT_ID, i18Msg(ctx, 'admin_feedback_template_text', tplData), {
                ...Markup.removeKeyboard(),
                parse_mode: 'HTML',
            })
        } else if (isPhoto(ctx.message)) {
            await ctx.telegram.sendMessage(botConfig.SUPPORT_FEEDBACK_CHAT_ID, i18Msg(ctx, 'admin_feedback_template_other', tplData), {
                ...Markup.removeKeyboard(),
                parse_mode: 'HTML',
            })

            const fileId = last(sortBy(ctx.message.photo, p => p.width))['file_id']
            const url = await ctx.telegram.getFileLink(fileId)
            feedbackText = `photo: ${url}`
            adminMessage = await ctx.telegram.sendPhoto(botConfig.SUPPORT_FEEDBACK_CHAT_ID, {
                url: url.toString()
            }, {
                caption: ctx.message.caption,
                parse_mode: 'HTML',
            })
        } else {
            feedbackText = 'other media: ' + JSON.stringify(ctx.message)
            const template = i18Msg(ctx, 'admin_feedback_template_other', tplData)
            await ctx.telegram.sendMessage(botConfig.SUPPORT_FEEDBACK_CHAT_ID, template, {
                ...Markup.removeKeyboard(),
                parse_mode: 'HTML',
            })
            adminMessage = await ctx.telegram.forwardMessage(botConfig.SUPPORT_FEEDBACK_CHAT_ID, ctx.chat.id, ctx.message.message_id)
        }


        await db.repoFeedback.saveFeedback({
            userId: ctx.session.user.id,
            messageId: ctx.message.message_id,
            feedbackText,
            adminChatId: botConfig.SUPPORT_FEEDBACK_CHAT_ID,
            adminMessageId: adminMessage.message_id
        })

        if (ctx.session.feedbackScene.messagesSent === 0) {
            await ctx.replyWithHTML(i18Msg(ctx, 'thank_you_for_custom_message'))
        } else {
            if (ctx.session.feedbackScene.messagesSent === 5) {
                const messageSticker = await ctx.replyWithSticker(i18Msg(ctx, 'sticker_stop_it'))
                await sleep(1000)
                await ctx.deleteMessage(messageSticker.message_id)
            }
            await ctx.replyWithHTML(i18Msg(ctx, 'your_feedback_was_amended'))
        }
        ctx.session.feedbackScene.messagesSent++

    } else {
        console.log(`ERROR: SUPPORT_FEEDBACK_CHAT_ID IS NULL, But we have message: '${'text' in ctx.message ? ctx.message.text : '?'}'`)
    }
}


function prepareSessionStateIfNeeded(ctx: ContextMessageUpdate) {
    const {
        messagesSent
    } = ctx.session.feedbackScene || {}

    ctx.session.feedbackScene = {
        messagesSent: SessionEnforcer.number(messagesSent, 0),
    }
}

function postStageActionsFn(bot: Composer<ContextMessageUpdate>): void {
    bot
        .action(/^mail_survey_(.+)_(.+)/, async ctx => {
            await ctx.answerCbQuery()
            if ('message' in ctx.update.callback_query && 'text' in ctx.update.callback_query.message) {
                const original = ctx.update.callback_query.message.text
                const choosenText = findInlineBtnTextByCallbackData(ctx, ctx.match[0])

                const questionId = ctx.match[1]
                await db.repoFeedback.saveQuiz({
                    userId: ctx.session.user.id,
                    question: questionId,
                    answer: choosenText
                })

                await ctx.editMessageText(i18Msg(ctx, 'mail_survey_done', {original, choosen: choosenText}))
            }
        })
}

export const feedbackScene: SceneRegister = {
    scene,
    postStageActionsFn
}

export type IsListening = 'like' | 'dislike' | 'text'

export interface FeedbackSceneState {
    messagesSent: number
}
