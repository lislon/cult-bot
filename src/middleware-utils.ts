import TelegrafI18n from 'telegraf-i18n'
import path from 'path'
import updateLogger from 'telegraf-update-logger'
import session from 'telegraf/session';
import telegrafThrottler from 'telegraf-throttler';
import { config } from 'dotenv'
import RedisSession from 'telegraf-session-redis'
import { ContextMessageUpdate } from './interfaces/app-interfaces'
import { mskMoment } from './util/moment-msk'
import { Session } from 'inspector';

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

export const i18n = new TelegrafI18n({
    defaultLanguage: 'ru',
    directory: path.resolve(__dirname, 'locales'),
    useSession: false,
    allowMissing: false,
    sessionName: 'session'
});

export default {
    i18n: i18n.middleware(),
    telegrafThrottler: telegrafThrottler({
        onThrottlerError: async (ctx: ContextMessageUpdate, next, throttlerName, error) => {
            console.log(`Ooops, encountered an error for ${ctx.updateType}`, error)
            await ctx.replyWithHTML(ctx.i18n.t('shared.something_went_wrong_dev', {
                error: error.toString().substr(0, 1000),
                time: mskMoment().toISOString(),
                session: JSON.stringify(ctx.session, undefined, 2)
            }))
            // console.log(throttlerName, error)
        }
    }),
    logger: updateLogger({colors: true}),
    session: sessionMechanism
}

