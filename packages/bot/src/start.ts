import { Telegraf } from 'telegraf'
import { ContextMessageUpdate } from './interfaces/app-interfaces'
import express, { Request, Response } from 'express'
import { botConfig } from './util/bot-config'
import { logger } from './util/logger'
import { db, pgp } from './database/db'
import { i18n } from './util/i18n'
import { adminIds, adminUsernames } from './util/admins-list'
import { Event } from './template/Event'
import ReactDOMServer from 'react-dom/server'
import { rawBot } from './raw-bot'
import { initBot } from './bot'
import { getRedis } from './util/reddis'
import got from 'got'

const app = express()

async function notifyAdminsAboutRestart() {
    const redisVersionKey = 'HEROKU_SLUG_COMMIT'
    try {
        const version = await getRedis().get(redisVersionKey)
        if (version !== botConfig.HEROKU_SLUG_COMMIT) {
            await getRedis().set(redisVersionKey, botConfig.HEROKU_SLUG_COMMIT)
            const admins = await db.repoUser.findUsersByUsernamesOrIds(adminUsernames, adminIds)

            const text = i18n.t('ru', 'scenes.admin_scene.update_report', {
                version: botConfig.HEROKU_RELEASE_VERSION,
                commit: botConfig.HEROKU_SLUG_COMMIT?.substring(botConfig.HEROKU_SLUG_COMMIT.length - 7)
            })
            for (const admin of admins) {
                try {
                    await rawBot.telegram.sendMessage(admin.tid, text, {
                        parse_mode: 'HTML',
                        disable_notification: true
                    })
                } catch (e) {
                    logger.warn(`failed to send to admin.id = ${admin.id}`)
                    logger.warn(e)
                }
            }
        }
    } catch (e) {
        logger.warn(e)
    }
}

class BotStart {
    static PATH = botConfig.TELEGRAM_TOKEN;

    public static expressMiddleware(bot: Telegraf<ContextMessageUpdate>) {
        return bot.webhookCallback(`/${BotStart.PATH}`)
    }

    public static async startDevMode(bot: Telegraf<ContextMessageUpdate>) {
        logger.info( 'Starting a bot in development mode');
        await got.get(`https://api.telegram.org/bot${botConfig.TELEGRAM_TOKEN}/deleteWebhook`)
        await bot.launch()
        logger.info('Started')
    }

    public static async startProdMode(bot: Telegraf<ContextMessageUpdate>) {
        logger.info('Starting a bot in production mode');
        // If webhook not working, check fucking motherfucking UFW that probably blocks a port...

        if (!botConfig.HEROKU_APP_NAME) {
            logger.error('process.env.HEROKU_APP_NAME must be defined to run in PROD')
            process.exit(1)
        }
        if (!botConfig.WEBHOOK_PORT) {
            logger.error('process.env.WEBHOOK_PORT must be defined to run in PROD')
            process.exit(1)
        }

        const hookUrl = `https://${botConfig.HEROKU_APP_NAME}.herokuapp.com:${botConfig.WEBHOOK_PORT}/${BotStart.PATH}`
        const success = await bot.telegram.setWebhook(
            hookUrl
        )
        if (success) {
            logger.info(`hook ${hookUrl} is set. (To delete: https://api.telegram.org/bot${botConfig.TELEGRAM_TOKEN}/deleteWebhook ) Starting app at ${botConfig.PORT}`)
        } else {
            logger.error(`hook was not set!`)
            const webhookStatus = await bot.telegram.getWebhookInfo()
            logger.error('Webhook status', JSON.stringify(webhookStatus))
            process.exit(2)
        }

        const webhookStatus = await bot.telegram.getWebhookInfo()

        logger.info('Webhook status: ' + JSON.stringify(webhookStatus))

        const closeAllConnections = () => {
            bot.stop('SIGINT')
            pgp.end()
            getRedis().end();
        }
        process.once('SIGINT', closeAllConnections)
        process.once('SIGTERM', closeAllConnections)

        await notifyAdminsAboutRestart()
    }
}

if (botConfig.BOT_DISABLED === false) {
    if (botConfig.NODE_ENV === 'development') {
        BotStart.startDevMode(rawBot)
    }
    initBot(rawBot)
} else {
    logger.info('Bot is disabled by BOT_DISABLED')
}

app.use(BotStart.expressMiddleware(rawBot))


app.get('/event/:id', async (request: Request<{ id: number }>, response: Response) => {
    const [event] = await db.repoEventsCommon.getFirstEvent()
    if (event !== undefined) {
        const result = ReactDOMServer.renderToString(Event(event))
        return response.contentType('text/html').send(result)
    } else {
        return response.status(404).send()
    }
})

app.use('/api', (request: Request, response: Response) => {
    response.send('hi')
})

app.use('/me', (request: Request, response: Response) => {
    response.send(JSON.stringify(request.headers))
})

app.use(function (err: any, req: any, res: any, next: any) {
    logger.error(err.stack)
    next(err)
})

app.listen(botConfig.PORT, () => {
    if (botConfig.NODE_ENV === 'production') {
        if (botConfig.BOT_DISABLED === false) {
            BotStart.startProdMode(rawBot).then(async () => {
                logger.info(`Bot started on port ${botConfig.PORT}!`)
            })
        } else {
            logger.info(`Bot is disabled or NODE_ENV (${botConfig.NODE_ENV}) is not production`)
        }
    } else {
        logger.info(`HTTP started on port ${botConfig.PORT}!`)
    }
})
