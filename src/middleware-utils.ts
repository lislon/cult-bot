import TelegrafI18n from 'telegraf-i18n'
import path from 'path'
import updateLogger from 'telegraf-update-logger'
import session from 'telegraf/session';
import telegrafThrottler from 'telegraf-throttler';

const Telegraf = require('telegraf')
// const RedisSession = require('telegraf-session-redis')
//
// const reddisSession = new RedisSession({
//     store: {
//         host: process.env.REDIS_HOST || '127.0.0.1',
//         port: process.env.REDIS_PORT || 6379
//     }
// })


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
        onThrottlerError: async (ctx, next, throttlerName, error) => {
            console.log(throttlerName, error)
        }
    }),
    logger: updateLogger({colors: true}),
    session: session()
}

