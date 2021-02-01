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
import { editMessageAndButtons, getMsgId, getNextWeekRange, ruFormat } from '../../scenes/shared/shared-logic'
import { ScenePack } from '../../database/db-packs'
import { formatUserName } from '../../util/misc-utils'

const scene = new BaseScene<ContextMessageUpdate>('support_chat_scene');

const {sceneHelper, i18nSharedBtnName, actionName, i18Btn, i18Msg} = i18nSceneHelper(scene)

export const supportFeedbackMiddleware = new Composer<ContextMessageUpdate>()

export const filterOnlyFeedbackChat = Composer.filter((ctx) =>
    botConfig.SUPPORT_FEEDBACK_CHAT_ID === undefined || ctx.chat.id === botConfig.SUPPORT_FEEDBACK_CHAT_ID)

interface FormattedMailedMessages {
    text: string
    btns: CallbackButton[][]
    webPreview: boolean
}

async function formatMessage(ctx: ContextMessageUpdate, msg: Message, allPacks: ScenePack[], webPreview: boolean): Promise<FormattedMailedMessages & { hasErrors: boolean }> {
    let text = parseTelegramMessageToHtml(msg)
    const matchButtonAtEnd = text.match(/^\s*\[.+\]\s*$/gm)
    const btns: CallbackButton[][] = []
    let hasErrors = false;

    (matchButtonAtEnd || []).forEach((btnMatch: string) => {
        const searchForPackTitle = btnMatch.replace(/^\s*\[\s*/, '').replace(/\s*\]\s*$/, '').toLowerCase().trim()

        let replaceOnTo = ''
        if (searchForPackTitle === 'подборки' || searchForPackTitle === 'подборка') {
            btns.push([Markup.callbackButton(' 📚 Подборки', `packs_scene.direct_menu`)])
        } else {
            const packData = allPacks.find(p => p.title.toLowerCase() === searchForPackTitle)

            if (packData !== undefined) {
                btns.push([Markup.callbackButton(packData.title, `packs_scene.direct_${packData.id}`)])
            } else {
                replaceOnTo = i18Msg(ctx, 'pack_not_found', {
                    title: searchForPackTitle,
                })
                hasErrors = true
            }
        }
        text = text.replace(btnMatch, replaceOnTo).trimEnd()
    })

    return {text, btns, webPreview, hasErrors}
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

    const blockedUsers: number[] = []
    const sentOkUsers: number[] = []

    const users = await db.repoUser.listUsersForMailing(botConfig.MAILINGS_PER_WEEK_MAX);
    logger.info(`Starting mailing to ${users.length}`)
    const nowFormat = ruFormat(new Date(), 'yyyy-MM-dd')


    for (const user of users) {
        try {
            await telegram.sendMessage(user.tid, mailMsg.text, Extra.HTML()
                .webPreview(mailMsg.webPreview)
                .markup(Markup.inlineKeyboard(mailMsg.btns)
                ))

            sentOkUsers.push(user.id)
            await sleep(1000.0 / botConfig.MAILINGS_PER_SECOND)
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
        maxPerWeek: botConfig.MAILINGS_PER_WEEK_MAX
    }), {
        parse_mode: 'HTML'
    })
}

let mailingMessages: Record<number, FormattedMailedMessages> = {}

async function startMailing(ctx: ContextMessageUpdate, mailingId: number) {
    await editMessageAndButtons(ctx, [], i18MsgSupport(`mailing_started`, {
        name: formatUserName(ctx)
    }))
    setTimeout(startMailings, 0, ctx.telegram, mailingId)
}

supportFeedbackMiddleware
    .command('stat', async (ctx: ContextMessageUpdate, next: any) => {
        if (botConfig.SUPPORT_FEEDBACK_CHAT_ID !== undefined) {
            await ctx.replyWithHTML(await db.repoFeedback.getQuizStats())
        }
        await next()
    })
    .hears(/^(s|ы)(i|ш)?(f)?\s*$/i, async (ctx: ContextMessageUpdate) => {
        const webPreview = ctx.match[2] !== undefined
        const force = ctx.match[3] === 'f'
        if (ctx.message?.reply_to_message?.message_id !== undefined) {
            const messageId = ctx.message.reply_to_message.message_id

            const allPacks = await db.repoPacks.listPacks({
                interval: getNextWeekRange(new Date())
            })

            const messageToSend = await formatMessage(ctx, ctx.message.reply_to_message, allPacks, webPreview)
            const users = await db.repoUser.listUsersForMailing(botConfig.MAILINGS_PER_WEEK_MAX)
            mailingMessages = {[messageId]: messageToSend}

            const previewMessage = await ctx.replyWithHTML(messageToSend.text, Extra.webPreview(messageToSend.webPreview).markup(
                Markup.inlineKeyboard(messageToSend.btns)
            ))

            if (force === true) {
                await startMailing(ctx, messageId)
            } else {
                const startMailing = Markup.callbackButton(i18Btn(ctx, 'mailing_start', {
                    users: users.length,
                    env: botConfig.HEROKU_APP_NAME.replace(/.+-(\w+)$/, '$1').toUpperCase()
                }), 'mailing_start_' + messageId)

                const cancel = Markup.callbackButton(i18Btn(ctx, 'cancel'), `mailing_cancel_${previewMessage.message_id}_${getMsgId(ctx)}`)
                const spacer = Markup.callbackButton(i18Btn(ctx, 'spacer'), `mailing_dummy`)

                let btns: CallbackButton[][] = []
                let msg = ''
                if (messageToSend.hasErrors) {
                    msg = i18Msg(ctx, 'has_errors')
                    btns = [[cancel]]
                } else {
                    btns = [[cancel], [spacer], [startMailing]]
                    if (messageToSend.btns.length > 0) {
                        msg = i18Msg(ctx, 'ready_to_send')
                    } else {
                        const list = allPacks.map(p => ` [ ${p.title} ]`).join('\n')
                        msg = i18Msg(ctx, 'ready_to_send_with_packs', {list})
                    }
                }


                await ctx.replyWithHTML(msg, Extra.markup(
                    Markup.inlineKeyboard(btns)
                ))
            }
        }
    })
    .action(/^mailing_dummy$/, async (ctx: ContextMessageUpdate) => {
        await ctx.answerCbQuery()
    })
    .action(/^mailing_cancel_(\d+)_(\d+)$/, async (ctx: ContextMessageUpdate) => {
        await ctx.answerCbQuery()
        await ctx.deleteMessage(getMsgId(ctx))
        await ctx.deleteMessage(+ctx.match[1])
        await ctx.deleteMessage(+ctx.match[2])
    })
    .action(/^mailing_start_(\d+)$/, async (ctx: ContextMessageUpdate) => {
        await ctx.answerCbQuery()
        const mailingId = +ctx.match[1]
        await startMailing(ctx, mailingId)
    })
    .hears(/.+/, async (ctx: ContextMessageUpdate, next: any) => {
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