import { Telegraf } from 'telegraf'
import { ContextMessageUpdate } from './interfaces/app-interfaces'
import express, { Request, Response, json, Application } from 'express'
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
import { oAuth2 } from './api-server/middleware/oauth2'
import { apiRouter } from './api-server/controller/api'
import { swaggerMiddleware } from './api-server/middleware/swagger-middleware'
import morganBody from 'morgan-body'
import bodyParser from 'body-parser'
import https, { Server } from 'https'
import * as fs from 'fs'
import { ServerOptions } from 'https'

import * as Sentry from '@sentry/node';
import * as Tracing from '@sentry/tracing';

const app = express()

if (botConfig.SENTRY_DSN !== '') {
    Sentry.init({
        dsn: botConfig.SENTRY_DSN,
        release: `culthubbot@${botConfig.HEROKU_RELEASE_VERSION}`,
        environment: botConfig.HEROKU_APP_NAME,

        // Set tracesSampleRate to 1.0 to capture 100%
        // of transactions for performance monitoring.
        // We recommend adjusting this value in production
        tracesSampleRate: botConfig.SENTRY_SAMPLE_RATE,
        integrations: [
            // enable HTTP calls tracing
            new Sentry.Integrations.Http({ tracing: true }),
            // enable Express.js middleware tracing
            new Tracing.Integrations.Express({
                // to trace all requests to the default router
                app,
                // alternatively, you can specify the routes you want to trace:
                // router: someRouter,
            }),
        ],

    });
}

async function notifyAdminsAboutRestart() {
    const redisVersionKey = 'HEROKU_SLUG_COMMIT'
    try {
        const version = await getRedis().get(redisVersionKey)
        if (version !== botConfig.HEROKU_SLUG_COMMIT && botConfig.HEROKU_SLUG_COMMIT !== undefined) {
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
                    logger.warn(`failed to send to admin.id = ${admin.tid}`)
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

    public static async startDevMode(bot: Telegraf<ContextMessageUpdate>): Promise<void> {
        logger.info( 'Starting a bot in development mode');
        await got.get(`https://api.telegram.org/bot${botConfig.TELEGRAM_TOKEN}/deleteWebhook`)

        await bot.launch()
        logger.info('Started')
    }

    public static async startProdMode(bot: Telegraf<ContextMessageUpdate>) {
        logger.info('Starting a bot in production mode');
        // If webhook not working, check fucking motherfucking UFW that probably blocks a port...

        if (!botConfig.WEBHOOK_PORT) {
            logger.error('process.env.WEBHOOK_PORT must be defined to run in PROD')
            process.exit(1)
        }

        const hookUrl = `https://${botConfig.WEBHOOK_HOST}:${botConfig.WEBHOOK_PORT}/${BotStart.PATH}`
        const success = await bot.telegram.setWebhook(
            hookUrl, {
                drop_pending_updates: botConfig.DROP_PENDING_UPDATES,
                certificate: botConfig.LISTEN_DIRECT_ON_HTTPS ? {
                    source: botConfig.DIRECT_HTTPS_CERT_PATH
                } : undefined,
            }
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

        const closeAllConnections = async (reason: string) => {
            try {
                bot.stop(reason)
            } catch (e) {
                if (e.message !== 'Bot is not running!') {
                    logger.warn(e)
                }
            }
            await Sentry.close()
            pgp.end()
            getRedis().end();
        }
        process.once('SIGINT', async () => await closeAllConnections('SIGTERM'))
        process.once('SIGTERM', async () => await closeAllConnections('SIGTERM'))

        await notifyAdminsAboutRestart()
    }
}

if (botConfig.BOT_DISABLED === false) {
    if (botConfig.NODE_ENV === 'development') {
        (async function run() {
            await BotStart.startDevMode(rawBot)
        })()
    }
    initBot(rawBot)
} else {
    logger.info('Bot is disabled by BOT_DISABLED')
}

if (botConfig.AGRESSIVE_LOG) {
    // must parse body before morganBody as body will be logged
    app.use(bodyParser.json({
        type: 'application/json'
    }));

    morganBody(app, {
        logRequestBody: true,
        logResponseBody: true
    });
}

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());
app.use(BotStart.expressMiddleware(rawBot))

if (botConfig.NODE_ENV === 'development') {
    app.use(swaggerMiddleware)
}
app.use('/api/v1', oAuth2, apiRouter)

app.get('/event/:id', async (request: Request<{ id: number }>, response: Response) => {
    const [event] = await db.repoEventsCommon.getFirstEvent()
    if (event !== undefined) {
        const result = ReactDOMServer.renderToString(Event(event))
        return response.contentType('text/html').send(result)
    } else {
        return response.status(404).send()
    }
})

app.use(function (err: any, req: any, res: any, next: any) {
    logger.error(err.stack)
    next(err)
})
app.use(Sentry.Handlers.errorHandler());

function createHttpOrHttps() {
    let server: Server | Application

    if (botConfig.LISTEN_DIRECT_ON_HTTPS) {
        logger.warn(`Listening https on port ${botConfig.PORT} using custom certificate ${botConfig.DIRECT_HTTPS_KEY_PATH}`)
        const serverOptions: ServerOptions = {
            key: fs.readFileSync(botConfig.DIRECT_HTTPS_KEY_PATH),
            cert: fs.readFileSync(botConfig.DIRECT_HTTPS_CERT_PATH),
            passphrase: botConfig.DIRECT_HTTPS_KEY_PASS
        }
        server = https.createServer(serverOptions, app)
    } else {
        server = app
    }
    return server
}

const server = createHttpOrHttps()

server.listen(botConfig.PORT, () => {
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
