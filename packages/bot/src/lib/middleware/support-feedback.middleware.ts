import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { Composer, Markup, Scenes } from 'telegraf'
import { db } from '../../database/db'
import { botConfig } from '../../util/bot-config'
import { i18n } from '../../util/i18n'
import { i18nSceneHelper } from '../../util/scene-helper'
import { parseTelegramMessageToHtml } from '../message-parser/message-parser'
import { mySlugify } from '../../scenes/shared/shared-logic'
import { ScenePack } from '../../database/db-packs'
import { InlineKeyboardButton, Message, ReplyMessage } from 'typegram'
import emojiRegex from 'emoji-regex'
import { getNextRangeForPacks } from '../../scenes/packs/packs-common'
import {
    FormattedMailedMessage,
    MailingSuccessResult,
    MailSender,
    MailUser,
    PreviewFormattedMailedMessage
} from './support/mail-sender'
import { i18MsgSupport } from './support/common'
import TextMessage = Message.TextMessage

const scene = new Scenes.BaseScene<ContextMessageUpdate>('support_chat_scene')

const {i18Msg} = i18nSceneHelper(scene)

export const supportFeedbackMiddleware = new Composer<ContextMessageUpdate>()

export const filterOnlyFeedbackChat = Composer.filter((ctx) =>
    botConfig.SUPPORT_FEEDBACK_CHAT_ID === undefined || ctx.chat.id === botConfig.SUPPORT_FEEDBACK_CHAT_ID)


export interface SurveyData {
    id: string
    question: string
    options: string[]
}

export function getSurveyData(msg: string): SurveyData | undefined {
    if (msg.match(/^\s*Опрос:?\s*$/mi)) {
        const idMatcher = msg.match(/id:\s*(.+)$/mi)
        const [text, buttons] = msg.split(/^\s*Опрос:?\s*$/im, 2)
        const surveyAnswers = buttons.match(/(?<=\[).+(?=\])/mg)
        return {
            id: idMatcher[1],
            question: text.trim(),
            options: surveyAnswers || []
        }
    }
    return undefined
}

export interface FormatMessageOptions {
    allPacks?: ScenePack[]
    webPreview?: boolean
    templateParams?: Record<string, string>
}

function replaceTemplateParams(text: string, templateParams?: Record<string, string>): string {
    for (const key in templateParams || []) {
        text = text.replace(`\${${key}}`, templateParams[key])
    }
    return text
}

function formatMessage(ctx: ContextMessageUpdate, msg: Omit<Message.TextMessage, 'reply_to_message'>, options: FormatMessageOptions): PreviewFormattedMailedMessage {
    let text = parseTelegramMessageToHtml(msg)

    text = replaceTemplateParams(text, options.templateParams)

    const matchButtonAtEnd = text.match(/^\s*\[.+\]\s*$/gm)
    const btns: InlineKeyboardButton.CallbackButton[][] = []
    let hasErrors = false

    const surveyData = getSurveyData(text)
    if (surveyData !== undefined) {
        return {
            text: surveyData.question,
            btns: surveyData.options.map(answer => [Markup.button.callback(
                answer.trim(), `mail_survey_${surveyData.id}_${mySlugify(answer.replace(emojiRegex(), '').trim())}`)]),
            webPreview: false,
            hasErrors: surveyData.options.length <= 1
        }
    } else {
        (matchButtonAtEnd || []).forEach((btnMatch: string) => {
            const searchForPackTitle = btnMatch.replace(/^\s*\[\s*/, '').replace(/\s*\]\s*$/, '').toLowerCase().trim()

            let replaceOnTo = ''
            if (searchForPackTitle === 'подборки' || searchForPackTitle === 'подборка') {
                btns.push([Markup.button.callback(' 📚 Подборки', `packs_scene.direct_menu`)])
            } else {
                const packData = options.allPacks?.find(p => p.title.toLowerCase().trim() === searchForPackTitle)

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

    return {text, btns, webPreview: options.webPreview || false, hasErrors}
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
        const ctxReplyToMessage = ctx.message.reply_to_message
        if ('reply_to_message' in ctx.message && isTextMessage(ctxReplyToMessage) && ctx.match[1] !== '') {
            const usersAndTickets: { ticketId: string, userId: number }[] = ctx.match[1].trim().split(/\s*[,]\s*/)
                .map(ticketUser => ticketUser.split('-'))
                .map(([ticketId, userId]) => ({
                    ticketId,
                    userId: +userId
                }))

            const userIds = usersAndTickets.map(u => u.userId)
            const users = await db.repoUser.findUsersByIds(userIds)

            const previewFormattedMailedMessage: PreviewFormattedMailedMessage = formatMessage(ctx, ctxReplyToMessage, {
                templateParams: {
                    ticketNumbers: '1,2 (для примера)'
                }
            })
            await mailing.armMessage(ctx, {
                orderMessageId: ctxReplyToMessage.message_id,
                formatMessage: (user: MailUser) => {
                    return formatMessage(ctx, ctxReplyToMessage, {
                        templateParams: {
                            ticketNumbers: usersAndTickets.filter(({userId}) => userId === user.id).map(({ticketId}) => ticketId).join(', ')
                        }
                    })
                },
                getRecipients: async () => users,
                previewMessage: async () => previewFormattedMailedMessage,
                previewAdditionalMsg(): string | undefined {
                    if (users.length !== userIds.length) {
                        return `Внимание. Найдено ${users.length} пользователей, а запрошено: ${userIds.length}`
                    }
                    return undefined
                },
                skipReview: false,
            })

        } else {
            await ctx.replyWithHTML('Инструкция по команде qr_tickets https://www.notion.so/6c2e844920d94467943fdcb4505cbe53')
        }
    })
    .hears(/^u(.*)$/i, async ctx => {
        if ('reply_to_message' in ctx.message && isTextMessage(ctx.message.reply_to_message) && ctx.match[1] !== '') {
            const userIds = ctx.match[1].trim().split(/\s*[,]\s*/).map(u => +u)
            const messageToSend = formatMessage(ctx, ctx.message.reply_to_message, {
                webPreview: false,
                allPacks: []
            })
            const users = await db.repoUser.findUsersByIds(userIds)

            await mailing.armMessage(ctx, {
                orderMessageId: ctx.message.reply_to_message.message_id,
                formatMessage: () => messageToSend,
                getRecipients: async () => users,
                previewMessage: async () => messageToSend,
                previewAdditionalMsg(): string | undefined {
                    if (users.length !== userIds.length) {
                        return `Внимание. Найдено ${users.length} пользователей, а запрошено: ${userIds.length}`
                    }
                    return undefined
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
            const messageToSend = formatMessage(ctx, ctx.message.reply_to_message, {
                webPreview,
                allPacks,
            })

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