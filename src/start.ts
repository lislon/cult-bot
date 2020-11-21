import { Telegraf } from 'telegraf'
import { rawBot } from './bot'
import logger from './util/logger'
import { getGoogleSpreadSheetURL } from './scenes/shared/shared-logic'
import { ContextMessageUpdate } from './interfaces/app-interfaces'
import rp from 'request-promise'
import express, { Request, Response } from 'express'
import { botConfig } from './util/bot-config'

const app = express()

class BotStart {
    static PATH = 'tlg'

    public static expressMiddleware(bot: Telegraf<ContextMessageUpdate>) {
        return bot.webhookCallback(`/${BotStart.PATH}`)
    }

    private static printDiagnostic() {
        logger.debug(undefined, `google docs db: ${getGoogleSpreadSheetURL()}` );
    }

    public static startDevMode(bot: Telegraf<ContextMessageUpdate>) {
        logger.debug(undefined, 'Starting a bot in development mode');
        BotStart.printDiagnostic()

        rp(`https://api.telegram.org/bot${botConfig.TELEGRAM_TOKEN}/deleteWebhook`).then(() => {
            bot.startPolling()
        });
    }

    public static async startProdMode(bot: Telegraf<ContextMessageUpdate>) {
        logger.debug(undefined, 'Starting a bot in production mode');
        // If webhook not working, check fucking motherfucking UFW that probably blocks a port...
        BotStart.printDiagnostic()

        if (!botConfig.HEROKU_APP_NAME) {
            console.log('process.env.HEROKU_APP_NAME must be defined to run in PROD')
            process.exit(1)
        }
        if (!botConfig.WEBHOOK_PORT) {
            console.log('process.env.WEBHOOK_PORT must be defined to run in PROD')
            process.exit(1)
        }
        const hookUrl = `https://${botConfig.HEROKU_APP_NAME}.herokuapp.com:${botConfig.WEBHOOK_PORT}/${BotStart.PATH}`
        const success = await bot.telegram.setWebhook(
            hookUrl
        )
        if (success) {
            console.log(`hook ${hookUrl} is set. (To delete: https://api.telegram.org/bot${botConfig.TELEGRAM_TOKEN}/deleteWebhook ) Starting app at ${botConfig.PORT}`)
        } else {
            console.error(`hook was not set!`)
            const webhookStatus = await bot.telegram.getWebhookInfo();
            console.log('Webhook status', webhookStatus);
            process.exit(2)
        }

        const webhookStatus = await bot.telegram.getWebhookInfo();

        console.log('Webhook status', webhookStatus);
    }
}

if (botConfig.BOT_DISABLED === false) {
    if (botConfig.NODE_ENV === 'development') {
        BotStart.startDevMode(rawBot)
    }
} else {
    console.log('Bot is disabled by BOT_DISABLED')
}

app.use(BotStart.expressMiddleware(rawBot))

app.use('/api', (request: Request, response: Response) => {
    response.send('hi')
})

app.use('/me', (request: Request, response: Response) => {
    response.send(JSON.stringify(request.headers))
})

app.use(logErrors)
function logErrors (err: any, req: any, res: any, next: any) {
    console.error(err.stack)
    next(err)
}

app.listen(botConfig.PORT, () => {
    if (botConfig.BOT_DISABLED === undefined && botConfig.NODE_ENV === 'production') {
        BotStart.startProdMode(rawBot)
    }

    console.log(`Bot started on port ${botConfig.PORT}!`)
})
