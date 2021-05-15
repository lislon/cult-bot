import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { Composer, Markup, Scenes } from 'telegraf'
import { db } from '../../database/db'
import { botConfig } from '../../util/bot-config'
import { i18n } from '../../util/i18n'
import { i18nSceneHelper } from '../../util/scene-helper'
import { parseTelegramMessageToHtml } from '../message-parser/message-parser'
import { getMsgId, mySlugify } from '../../scenes/shared/shared-logic'
import { ScenePack } from '../../database/db-packs'
import { InlineKeyboardButton, Message, ReplyMessage } from 'typegram'
import emojiRegex from 'emoji-regex'
import { getNextRangeForPacks } from '../../scenes/packs/packs-common'
import {
    FormattedMailedMessage,
    MailSender,
    PreviewFormattedMailedMessage, MailingResult, MailingSuccessResult
} from './support/mail-sender'
import TextMessage = Message.TextMessage
import { i18MsgSupport } from './support/common'

const scene = new Scenes.BaseScene<ContextMessageUpdate>('support_chat_scene')

const { i18Msg} = i18nSceneHelper(scene)

export const supportFeedbackMiddleware = new Composer<ContextMessageUpdate>()

export const filterOnlyFeedbackChat = Composer.filter((ctx) =>
    botConfig.SUPPORT_FEEDBACK_CHAT_ID === undefined || ctx.chat.id === botConfig.SUPPORT_FEEDBACK_CHAT_ID)


function isSurvey(msg: string) {
    return !!msg.match(/^\s*Опрос:?\s*$/mi)
}

export function getSurveyBtnsAndMsg(input: string): FormattedMailedMessage {
    const [text, buttons] = input.split(/^\s*Опрос:?\s*$/im, 2)
    const surveyAnswers = buttons.match(/(?<=\[).+(?=\])/mg)

    return {
        text: text.trim(),
        btns: (surveyAnswers || []).map(answer => [Markup.button.callback(
            answer.trim(), `mail_survey_` + mySlugify(answer.replace(emojiRegex(), '').trim())
        )]),
        webPreview: false
    }
}

async function formatMessage(ctx: ContextMessageUpdate, msg: Omit<Message.TextMessage, 'reply_to_message'>, allPacks: ScenePack[], webPreview: boolean): Promise<PreviewFormattedMailedMessage> {
    let text = parseTelegramMessageToHtml(msg)
    const matchButtonAtEnd = text.match(/^\s*\[.+\]\s*$/gm)
    const btns: InlineKeyboardButton.CallbackButton[][] = []
    let hasErrors = false

    if (isSurvey(text)) {
        const result = getSurveyBtnsAndMsg(text)

        return {...result, hasErrors: result.btns.length <= 1}
    } else {
        (matchButtonAtEnd || []).forEach((btnMatch: string) => {
            const searchForPackTitle = btnMatch.replace(/^\s*\[\s*/, '').replace(/\s*\]\s*$/, '').toLowerCase().trim()

            let replaceOnTo = ''
            if (searchForPackTitle === 'подборки' || searchForPackTitle === 'подборка') {
                btns.push([Markup.button.callback(' 📚 Подборки', `packs_scene.direct_menu`)])
            } else {
                const packData = allPacks.find(p => p.title.toLowerCase().trim() === searchForPackTitle)

                if (packData !== undefined) {
                    btns.push([Markup.button.callback(packData.title, `packs_scene.direct_${packData.id}`)])
                } else {
                    replaceOnTo = i18Msg(ctx, 'pack_not_found', {
                        title: searchForPackTitle,
                    })
                    hasErrors = true
                }
            }
            text = text.replace(btnMatch, replaceOnTo).trimEnd()
        })
    }

    return {text, btns, webPreview, hasErrors}
}


const mailing = new MailSender()

function isTextMessage(r: ReplyMessage): r is TextMessage & { reply_to_message: undefined } {
    return 'text' in r
}

supportFeedbackMiddleware
    .command('stat', async (ctx: ContextMessageUpdate, next: any) => {
        if (botConfig.SUPPORT_FEEDBACK_CHAT_ID !== undefined) {
            await ctx.replyWithHTML(await db.repoFeedback.getQuizStats())
        }
        await next()
    })
    .hears(/^qr_tickets(.*)$/i, async ctx => {
        if ('reply_to_message' in ctx.message && isTextMessage(ctx.message.reply_to_message) && ctx.match[1] !== '') {
            const userIds = ctx.match[1].trim().split(/\s*[,]\s*/).map(u => +u)
            const messageToSend = await formatMessage(ctx, ctx.message.reply_to_message, [], false)
            const users = await db.repoUser.findUsersByIds(userIds)

            await mailing.armMessage(ctx, {
                orderMessageId: ctx.message.reply_to_message.message_id,
                formatMessage: () => messageToSend,
                getRecipients: async () => users,
                previewMessage: async () => messageToSend,
                previewAdditionalMsg(previewMessage: PreviewFormattedMailedMessage): string | undefined {
                    if (users.length !== userIds.length) {
                        return `Внимание. Найдено ${users.length} пользователей, а запрошено: ${userIds.length}`
                    }
                    return undefined;
                },
                skipReview: false,
            })

        } else {
            await ctx.replyWithHTML('Чтобы использовать u, наберите эту команду в ответ на сообщение, которое хотите послать. Например u 1,2,5 ')
        }
    })
    .hears(/^u(.*)$/i, async ctx => {
        if ('reply_to_message' in ctx.message && isTextMessage(ctx.message.reply_to_message) && ctx.match[1] !== '') {
            const userIds = ctx.match[1].trim().split(/\s*[,]\s*/).map(u => +u)
            const messageToSend = await formatMessage(ctx, ctx.message.reply_to_message, [], false)
            const users = await db.repoUser.findUsersByIds(userIds)

            await mailing.armMessage(ctx, {
                orderMessageId: ctx.message.reply_to_message.message_id,
                formatMessage: () => messageToSend,
                getRecipients: async () => users,
                previewMessage: async () => messageToSend,
                previewAdditionalMsg(previewMessage: PreviewFormattedMailedMessage): string | undefined {
                    if (users.length !== userIds.length) {
                        return `Внимание. Найдено ${users.length} пользователей, а запрошено: ${userIds.length}`
                    }
                    return undefined;
                },
                skipReview: false,
            })

        } else {
            await ctx.replyWithHTML('Чтобы использовать u, наберите эту команду в ответ на сообщение, которое хотите послать. Например u 1,2,5 ')
        }
    })
    .hears(/^([sы])([iш])?(f)?\s*$/i, async ctx => {
        const webPreview = ctx.match[2] !== undefined
        const force = ctx.match[3] === 'f'
        if ('reply_to_message' in ctx.message && isTextMessage(ctx.message.reply_to_message)) {

            const allPacks = await db.repoPacks.listPacks({
                interval: getNextRangeForPacks(new Date())
            })
            const messageToSend = await formatMessage(ctx, ctx.message.reply_to_message, allPacks, webPreview)

            const users = await db.repoUser.listUsersForMailing(botConfig.MAILINGS_PER_WEEK_MAX)
            await mailing.armMessage(ctx, {
                orderMessageId: ctx.message.reply_to_message.message_id,
                formatMessage: () => messageToSend,
                getRecipients: async () => users,
                previewMessage: async () => messageToSend,
                previewAdditionalMsg: (previewMessage: PreviewFormattedMailedMessage) => {
                    if (previewMessage.btns.length === 0) {
                        return i18MsgSupport('ready_to_send_with_packs', {list: allPacks.map(p => ` [ ${p.title} ]`).join('\n')})
                    }
                    return undefined
                },
                onSuccess: async (result: MailingSuccessResult): Promise<void> => {
                    await db.repoUser.incrementMailingCounter(result.sentIds)
                },
                skipReview: force,
            })

        }
    })
    .use(mailing.middleware())
    .hears(/.+/, async (ctx: ContextMessageUpdate, next: any) => {
        if ('reply_to_message' in ctx.message && 'text' in ctx.message) {
            // ctx.telegram.sendMessage()
            const dbQuery = {
                admin_chat_id: botConfig.SUPPORT_FEEDBACK_CHAT_ID,
                admin_message_id: ctx.message.reply_to_message.message_id
            }
            try {
                const originalUserMessage = await db.repoFeedback.findFeedbackMessage(dbQuery)
                if (originalUserMessage !== null) {

                    const template = i18n.t(`ru`,
                        `scenes.feedback_scene.admin_response.template`,
                        {text: ctx.message.text})

                    await ctx.telegram.sendMessage(originalUserMessage.tid, template, {
                        parse_mode: 'HTML',
                        reply_to_message_id: originalUserMessage.message_id
                    })

                    await ctx.replyWithHTML(i18n.t(`ru`,
                        `scenes.feedback_scene.admin_response.message_sent`,
                        {template: template}))

                }
            } catch (e) {
                await ctx.replyWithHTML(i18n.t(`ru`,
                    `scenes.feedback_scene.admin_response.error`,
                    {message: e.message}))
                throw e
            }
        }

        await next()
    })