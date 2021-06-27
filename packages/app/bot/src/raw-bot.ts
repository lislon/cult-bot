import { Telegraf } from 'telegraf'
import { ContextMessageUpdate } from './interfaces/app-interfaces'
import { botConfig } from './util/bot-config'

export const rawBot: Telegraf<ContextMessageUpdate> = new Telegraf(botConfig.TELEGRAM_TOKEN, {
    telegram: {
        // feedback scene requires this, because otherwise it cannot obtain id message sent to admin feedback chat
        // https://core.telegram.org/bots/faq#how-can-i-make-requests-in-response-to-updates
        webhookReply: false
    }
})