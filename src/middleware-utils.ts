import TelegrafI18n from 'telegraf-i18n'
import path from 'path'
import updateLogger from 'telegraf-update-logger'
import session from 'telegraf/session';
import telegrafThrottler from 'telegraf-throttler';
import { config } from 'dotenv'
import RedisSession from 'telegraf-session-redis'

config();

const reddisSession = new RedisSession({
    store: {
        host: undefined,
        port: undefined,
        url: process.env.REDIS_URL
    }
})

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
    session: reddisSession
}

