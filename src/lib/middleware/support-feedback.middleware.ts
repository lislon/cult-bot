import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { BaseScene, Composer, Extra, Markup } from 'telegraf'
import { db } from '../../database/db'
import { botConfig } from '../../util/bot-config'
import { i18n } from '../../util/i18n'
import { Message } from 'telegram-typings'
import { CallbackButton } from 'telegraf/typings/markup'
import { Telegram } from 'telegraf/typings/telegram'
import { isBlockedError } from '../../util/error-handler'
import { logger } from '../../util/logger'
import { i18nSceneHelper, sleep } from '../../util/scene-helper'
import { parseTelegramMessageToHtml } from '../message-parser/message-parser'

const scene = new BaseScene<ContextMessageUpdate>('support_chat_scene');

const {sceneHelper, i18nSharedBtnName, actionName, i18Btn, i18Msg } = i18nSceneHelper(scene)

export const supportFeedbackMiddleware = new Composer<ContextMessageUpdate>()

export const filterOnlyFeedbackChat = Composer.filter((ctx) =>
    botConfig.SUPPORT_FEEDBACK_CHAT_ID === undefined || ctx.chat.id === botConfig.SUPPORT_FEEDBACK_CHAT_ID)

interface FormattedMailedMessages {
    text: string
    btns: CallbackButton[][]
}

async function formatMessage(msg: Message): Promise<FormattedMailedMessages> {
    let text = parseTelegramMessageToHtml(msg)
    const matchButtonAtEnd = text.match(/\[\s*(.+)\s*\]\s*$/)
    if (matchButtonAtEnd) {
        const packData = await db.repoPacks.findPackByTitle(matchButtonAtEnd[1])
        if (packData !== undefined) {
            const btns = [[Markup.callbackButton(packData.title, `packs_scene.direct_${packData.id}`)]]
            text = text.replace(/\[.+\]\s*$/, '')
            return { text, btns }
        } else {
            text = text.replace(/\[.+\]\s*$/, '[ название не найдено ⛔️ ]')
        }
    }

    return { text, btns: [[]] }
}

function i18MsgSupport(id: string, templateData?: any) {
    return i18n.t(`ru`, `scenes.support_chat_scene.${id}`, templateData)
}

async function startMailings(telegram: Telegram, mailingId: number) {
    if (mailingMessages[mailingId] === undefined) {
        await telegram.sendMessage(botConfig.SUPPORT_FEEDBACK_CHAT_ID, i18MsgSupport(`mailing_not_found`), {
            parse_mode: 'HTML'
        })
        return
    }
    const mailMsg = mailingMessages[mailingId]
    mailingMessages = {}

    await telegram.sendMessage(botConfig.SUPPORT_FEEDBACK_CHAT_ID, i18MsgSupport(`mailing_started`), {
        parse_mode: 'HTML'
    })

    const blockedUsers: number[] = []
    const sentOkUsers: number[] = []

    const users = await db.repoUser.listUsersForMailing(botConfig.MAX_MAILINGS_PER_WEEK);
    logger.info(`Starting mailing to ${users.length}`)

    for (const user of users) {
        try {
            await telegram.sendMessage(user.tid, mailMsg.text, Extra.HTML()
                .webPreview(false)
                .markup(Markup.inlineKeyboard(mailMsg.btns)
            ))
            sentOkUsers.push(user.id)
            await sleep(250)
        } catch (e) {
            if (isBlockedError(e)) {
                blockedUsers.push(user.id)
            } else {
                logger.error(`Failed to sent message to user ${user.id}`, e)
            }
        }
    }
    logger.info(`Mailing done. Sent=${sentOkUsers.length} Blocked=${blockedUsers.length}`)
    try {
        await db.task(async dbTx => {
            await dbTx.repoUser.incrementMailingCounter(sentOkUsers)
            await dbTx.repoUser.markAsBlocked(blockedUsers, new Date())
        })
    } catch (e) {
        logger.error(e)
        await telegram.sendMessage(botConfig.SUPPORT_FEEDBACK_CHAT_ID, e.toString(), {
            parse_mode: 'HTML'
        })

    }

    await telegram.sendMessage(botConfig.SUPPORT_FEEDBACK_CHAT_ID, i18MsgSupport(`mailing_done`, {
        users: sentOkUsers.length,
        blocked: blockedUsers.length,
        maxPerWeek: botConfig.MAX_MAILINGS_PER_WEEK
    }), {
        parse_mode: 'HTML'
    })
}

let mailingMessages: Record<number, FormattedMailedMessages> = {}

supportFeedbackMiddleware
    .command('stat', async (ctx: ContextMessageUpdate, next: any) => {
        if (botConfig.SUPPORT_FEEDBACK_CHAT_ID !== undefined) {
            await ctx.replyWithHTML(await db.repoFeedback.getQuizStats())
        }
        await next()
    })
    .hears(/^s/, async (ctx: ContextMessageUpdate, next: any) => {
        if (ctx.message?.reply_to_message?.message_id !== undefined) {
            const messageId = ctx.message.reply_to_message.message_id

            const messageToSend = await formatMessage(ctx.message.reply_to_message)
            const users = await db.repoUser.listUsersForMailing(botConfig.MAX_MAILINGS_PER_WEEK);
            mailingMessages = { [messageId]:  messageToSend }

            await ctx.replyWithHTML(messageToSend.text, Extra.markup(
                Markup.inlineKeyboard(messageToSend.btns)
            ))

            await ctx.replyWithHTML(i18Msg(ctx, 'ready_to_send'), Extra.markup(
                Markup.inlineKeyboard([Markup.callbackButton(i18Btn(ctx, 'mailing_start', {
                    users: users.length
                }), 'mailing_start_' + messageId)])
            ))
        }
    })
    .action(/mailing_start_(\d+)/, async (ctx: ContextMessageUpdate) => {
        await ctx.answerCbQuery()
        setTimeout(startMailings, 0, ctx.telegram, +ctx.match[1])
    })
    .hears(/.+/, async (ctx: ContextMessageUpdate, next: any) => {
        console.log(`support chat: (id=${ctx.chat.id}) ${ctx.message.text}`)

        if (ctx.message?.reply_to_message?.message_id !== undefined) {
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
                    { message: e.message }))
                throw e
            }
        }

        await next()
    })