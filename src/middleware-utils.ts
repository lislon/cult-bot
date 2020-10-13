import updateLogger from 'telegraf-update-logger'
import session from 'telegraf/session';
import telegrafThrottler from 'telegraf-throttler';
import { config } from 'dotenv'
import RedisSession from 'telegraf-session-redis'
import { ContextMessageUpdate } from './interfaces/app-interfaces'
import { i18n } from './util/i18n'
import { isDev } from './util/scene-helper'
import { parseISO } from 'date-fns'


config();

let sessionMechanism
if (process.env.REDIS_URL !== undefined) {
    sessionMechanism = new RedisSession({
        store: {
            host: undefined,
            port: undefined,
            url: process.env.REDIS_URL
        }
    })
} else {
    sessionMechanism = session()
}

const dateTimeMiddleware = async (ctx: ContextMessageUpdate, next: any) => {
    ctx.isNowOverridden = () => ctx.session.adminScene !== undefined && ctx.session.adminScene.overrideDate !== undefined
    ctx.now = () => {
        if (ctx.isNowOverridden()) {
            return parseISO(ctx.session.adminScene.overrideDate)
        } else {
            return new Date()
        }
    }

    await next()
}

export default {
    i18n: i18n.middleware(),
    dateTime: dateTimeMiddleware,
    telegrafThrottler: telegrafThrottler({
        onThrottlerError: async (ctx: ContextMessageUpdate, next, throttlerName, error) => {

            if (error.message === 'This job has been dropped by Bottleneck') {
                console.log(`Throttle limit ${throttlerName}: ${error} for user ${ctx.from.username}`)
            } else {
                console.log(`Ooops, encountered an error for ${ctx.updateType}`, error)
                if (isDev(ctx)) {
                    await ctx.replyWithHTML(ctx.i18n.t('shared.something_went_wrong_dev', {
                        error: error.toString().substr(0, 1000),
                        time: (new Date()).toString(),
                        session: JSON.stringify(ctx.session, undefined, 2)
                    }))
                } else {
                    await ctx.replyWithHTML(ctx.i18n.t('shared.something_went_wrong'))
                }
            }
            // console.log(throttlerName, error)
        }
    }),
    logger: updateLogger({colors: true}),
    session: sessionMechanism
}

