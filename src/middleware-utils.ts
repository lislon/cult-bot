import TelegrafI18n from 'telegraf-i18n'
import rateLimit, { RateLimitConfig } from 'telegraf-ratelimit';
import path from 'path'
import { ContextMessageUpdate } from './interfaces/app-interfaces'
import updateLogger from 'telegraf-update-logger'

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
    logger: updateLogger({colors: true})
}

