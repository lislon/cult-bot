import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { Composer } from 'telegraf'
import { db } from '../../database/db'
import { botConfig } from '../../util/bot-config'
import { i18n } from '../../util/i18n'

export const supportFeedbackMiddleware = new Composer<ContextMessageUpdate>()

supportFeedbackMiddleware
    .use(Composer.filter((ctx) =>
        botConfig.SUPPORT_FEEDBACK_CHAT_ID === undefined || ctx.chat.id === botConfig.SUPPORT_FEEDBACK_CHAT_ID)
    )
    .command('stat', async (ctx: ContextMessageUpdate, next: any) => {
        if (botConfig.SUPPORT_FEEDBACK_CHAT_ID !== undefined) {
            await ctx.replyWithHTML(await db.repoFeedback.getQuizStats())
        }
        await next()
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

                    await ctx.telegram.sendMessage(originalUserMessage.chat_id, template, {
                        parse_mode: 'HTML',
                        reply_to_message_id: originalUserMessage.message_id
                    })

                    await ctx.replyWithHTML(i18n.t(`ru`,
                        `scenes.feedback_scene.admin_response.message_sent`,
                        {template: template}))

                } else {
                    await ctx.replyWithHTML(
                        i18n.t(`ru`, `scenes.feedback_scene.admin_response.cant_find_original`,
                            {json: JSON.stringify(dbQuery)}))
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