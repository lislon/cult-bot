import TelegrafI18n from 'telegraf-i18n'
import rateLimit, { RateLimitConfig } from 'telegraf-ratelimit';
import path from 'path'
import { ContextMessageUpdate } from './interfaces/app-interfaces'
import updateLogger from 'telegraf-update-logger'
import session from 'telegraf/session';

const Telegraf = require('telegraf')
const RedisSession = require('telegraf-session-redis')

const reddisSession = new RedisSession({
    store: {
        host: process.env.REGIS_HOST || '127.0.0.1',
        port: process.env.REGIS_PORT || 6379
    }
})


export const i18n = new TelegrafI18n({
    defaultLanguage: 'ru',
    directory: path.resolve(__dirname, 'locales'),
    useSession: false,
    allowMissing: false,
    sessionName: 'session'
});

// Set limit to 9 messages per 3 seconds
const limitConfig: RateLimitConfig = {
    window: 3000,
    limit: 9,
    onLimitExceeded: (ctx: ContextMessageUpdate) => ctx.reply('Rate limit exceeded')
}

export default {
    i18n: i18n.middleware(),
    rateLimit: rateLimit(limitConfig),
    logger: updateLogger({colors: true}),
    session: reddisSession
}

