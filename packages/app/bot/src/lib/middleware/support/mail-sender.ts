import { InlineKeyboardButton } from 'typegram'
import Telegram from 'telegraf/typings/telegram'
import { botConfig } from '../../../util/bot-config'
import { db } from '../../../database/db'
import { logger } from '../../../util/logger'
import { Composer, Markup, MiddlewareFn, Scenes } from 'telegraf'
import { isBlockedError } from '../../../util/error-handler'
import { ContextMessageUpdate } from '../../../interfaces/app-interfaces'
import { editMessageAndButtons, EditMessageAndButtonsOptions, getMsgId } from '../../../scenes/shared/shared-logic'
import { i18MsgSupport } from './common'
import { formatUserName } from '../../../util/misc-utils'
import { sleep } from '../../../util/scene-utils'
import { i18nSceneHelper } from '../../../util/scene-helper'

export interface FormattedMailedMessage {
    text: string
    btns: InlineKeyboardButton.CallbackButton[][]
    webPreview: boolean
}

export interface PreviewFormattedMailedMessage extends FormattedMailedMessage {
    hasErrors?: boolean
}

export interface MailUser {
    id: number
    tid: number
}

export interface MailingOrder {
    orderMessageId: number
    skipReview: boolean

    formatMessage(user: MailUser): FormattedMailedMessage

    previewMessage(): Promise<PreviewFormattedMailedMessage>

    previewAdditionalMsg?(previewMessage: PreviewFormattedMailedMessage): string | undefined

    getRecipients: () => Promise<MailUser[]>

    onSuccess?(result: MailingSuccessResult): Promise<void>
}


export interface MailingSuccessResult {
    sentIds: number[]
    blockedIds: number[]
}

export type MailingResult = MailingSuccessResult | 'mailing_not_found'

export class MailSender {
    private mailingMessages: Record<number, MailingOrder> = {}

    public async armMessage(ctx: ContextMessageUpdate, order: MailingOrder): Promise<void> {
        this.mailingMessages[order.orderMessageId] = order

        if (order.skipReview === true) {
            await this.scheduleMailing(ctx, order.orderMessageId, {forceNewMsg: true})
        } else {
            const previewFormattedMessage = await order.previewMessage()


            const previewMessageTg = await ctx.replyWithHTML(previewFormattedMessage.text, {
                ...Markup.inlineKeyboard(previewFormattedMessage.btns),
                disable_web_page_preview: !previewFormattedMessage.webPreview
            })

            const startMailingBtn = Markup.button.callback(i18MsgSupport('keyboard.mailing_start', {
                users: (await order.getRecipients()).length,
                env: botConfig.HEROKU_APP_NAME.replace(/.+-(\w+)$/, '$1').toUpperCase()
            }), 'mailing_start_' + order.orderMessageId)

            const cancel = Markup.button.callback(i18MsgSupport('keyboard.cancel'), `mailing_cancel_${previewMessageTg.message_id}_${getMsgId(ctx)}`)
            const spacer = Markup.button.callback(i18MsgSupport('keyboard.spacer'), `mailing_dummy`)

            let btns: InlineKeyboardButton.CallbackButton[][] = []
            let msg = ''
            if (previewFormattedMessage.hasErrors) {
                msg = i18MsgSupport('has_errors')
                btns = [[cancel]]
            } else {
                btns = [[cancel], [spacer], [startMailingBtn]]
                const messageBeforeSend = order.previewAdditionalMsg?.(previewFormattedMessage)
                msg = messageBeforeSend !== undefined ? messageBeforeSend : i18MsgSupport('ready_to_send')
            }

            await ctx.replyWithHTML(msg, Markup.inlineKeyboard(btns))
        }


    }

    public async sendMail(telegram: Telegram, mailingId: number): Promise<MailingResult> {
        if (this.mailingMessages[mailingId] === undefined) {
            return 'mailing_not_found'
        }
        const mailMsg = this.mailingMessages[mailingId]
        this.mailingMessages = {}

        const blockedUsers: number[] = []
        const sentOkUsers: number[] = []

        //const users = await db.repoUser.listUsersForMailing(botConfig.MAILINGS_PER_WEEK_MAX);
        const recipients = await mailMsg.getRecipients()


        logger.info(`Starting mailing to ${recipients.length}`)

        for (const user of recipients) {
            try {
                const message = mailMsg.formatMessage(user)
                await telegram.sendMessage(user.tid, message.text, {
                    parse_mode: 'HTML',
                    disable_web_page_preview: !message.webPreview,
                    ...Markup.inlineKeyboard(message.btns)
                })

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

        await this.updateUsersLastMailings(sentOkUsers, blockedUsers)

        const success = {
            sentIds: sentOkUsers,
            blockedIds: blockedUsers
        }
        await mailMsg.onSuccess?.(success)
        return success
    }

    private async updateUsersLastMailings(sentOkUsers: number[], blockedUsers: number[]) {
        logger.debug(`Saving fact of sending for users. Sent=${sentOkUsers.join(',')} Blocked=${blockedUsers.length}`)
        await db.task(async dbTx => {
            await dbTx.repoUser.markAsBlocked(blockedUsers, new Date())
        })
    }

    private async scheduleMailing(ctx: ContextMessageUpdate, mailingId: number, options?: EditMessageAndButtonsOptions): Promise<void> {
        await editMessageAndButtons(ctx, [], i18MsgSupport(`mailing_started`, {
            name: formatUserName(ctx)
        }), options)
        setTimeout(async () => {
            try {
                const result = await this.sendMail(ctx.telegram, mailingId)
                if (result === 'mailing_not_found') {
                    await ctx.telegram.sendMessage(botConfig.SUPPORT_FEEDBACK_CHAT_ID, i18MsgSupport(`mailing_not_found`), {
                        parse_mode: 'HTML'
                    })
                } else {
                    await ctx.telegram.sendMessage(botConfig.SUPPORT_FEEDBACK_CHAT_ID,
                        i18MsgSupport(`mailing_done`, {
                            totalSent: result.sentIds.length,
                            totalBlocked: result.blockedIds.length,
                            blockedIds: result.blockedIds.length ? result.blockedIds.join(',') : 'никто :)',
                            maxPerWeek: botConfig.MAILINGS_PER_WEEK_MAX
                        }), {
                            parse_mode: 'HTML'
                        })
                }
            } catch (e) {
                await ctx.telegram.sendMessage(botConfig.SUPPORT_FEEDBACK_CHAT_ID, e.toString(), {
                    parse_mode: 'HTML'
                })
            }
        }, 0, ctx.telegram, mailingId)
    }

    public middleware(): MiddlewareFn<ContextMessageUpdate> {
        return (new Composer<ContextMessageUpdate>()
                .action(/^mailing_dummy$/, async ctx => {
                    await ctx.answerCbQuery()
                })
                .action(/^mailing_cancel_(\d+)_(\d+)$/, async ctx => {
                    await ctx.answerCbQuery()
                    await ctx.deleteMessage(getMsgId(ctx))
                    await ctx.deleteMessage(+ctx.match[1])
                    await ctx.deleteMessage(+ctx.match[2])
                })
                .action(/^mailing_start_(\d+)$/, async ctx => {
                    await ctx.answerCbQuery()
                    const mailingId = +ctx.match[1]
                    await this.scheduleMailing(ctx, mailingId)
                })
        ).middleware()
    }
}