import { Telegraf } from 'telegraf'
import { bot } from './bot'
import logger from './util/logger'
import { getGoogleSpreadSheetURL } from './scenes/shared/shared-logic'
import { ContextMessageUpdate } from './interfaces/app-interfaces'
import rp from 'request-promise'
import express, { Request, Response } from 'express'

const app = express()

class BotStart {
    static PATH = 'tlg'

    public static expressMiddleware(bot: Telegraf<ContextMessageUpdate>) {
        process.env.NODE_ENV === 'production' ? BotStart.startProdMode(bot) : BotStart.startDevMode(bot);

        return bot.webhookCallback(`/${process.env.TELEGRAM_TOKEN}`)
    }

    private static printDiagnostic() {
        logger.debug(undefined, `google docs db: ${getGoogleSpreadSheetURL()}` );
    }

    public static startDevMode(bot: Telegraf<ContextMessageUpdate>) {
        logger.debug(undefined, 'Starting a bot in development mode');
        BotStart.printDiagnostic()

        rp(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/deleteWebhook`).then(() => {
            bot.startPolling()
        });
    }

    private static async startProdMode(bot: Telegraf<ContextMessageUpdate>) {
        logger.debug(undefined, 'Starting a bot in production mode');
        // If webhook not working, check fucking motherfucking UFW that probably blocks a port...
        BotStart.printDiagnostic()

        if (!process.env.HEROKU_APP_NAME) {
            console.log('process.env.HEROKU_APP_NAME must be defined to run in PROD')
            process.exit(1)
        }
        if (!process.env.WEBHOOK_PORT) {
            console.log('process.env.WEBHOOK_PORT must be defined to run in PROD')
            process.exit(1)
        }
        const success = await bot.telegram.setWebhook(
            `https://${process.env.HEROKU_APP_NAME}.herokuapp.com:${process.env.WEBHOOK_PORT}/${BotStart.PATH}`
        )
        if (success) {
            console.log(`hook is set. (To delete: https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/deleteWebhook ) Starting app at ${process.env.PORT}`)
        } else {
            console.error(`hook was not set!`)
            const webhookStatus = await bot.telegram.getWebhookInfo();
            console.log('Webhook status', webhookStatus);
            process.exit(2)
        }

        await bot.startWebhook(`/${BotStart.PATH}`, undefined, +process.env.PORT);

        const webhookStatus = await bot.telegram.getWebhookInfo();

        console.log('Webhook status', webhookStatus);
    }
}

if (process.env.BOT_DISABLED === undefined) {
    if (process.env.NODE_ENV === 'production') {
        app.use(BotStart.expressMiddleware(bot))
    } else {
        BotStart.startDevMode(bot)
    }
} else {
    console.log('Bot is disabled by BOT_DISABLED')
}

app.use('/api', (request: Request, response: Response) => {
    response.send('hi')
})

app.use(logErrors)
function logErrors (err: any, req: any, res: any, next: any) {
    console.error(err.stack)
    next(err)
}

app.listen(process.env.PORT, () => {
    console.log(`Bot started on port ${process.env.PORT}!`)
})
