type Envs = 'development' | 'production' | 'test'

export class BotConfig {
    public readonly DATABASE_URL: string
    public readonly GOOGLE_ANALYTICS_ID: string|undefined
    public readonly GOOGLE_ANALYTICS_COUNT_ADMINS: boolean
    public readonly GOOGLE_DOCS_ID: string
    public readonly HEROKU_APP_NAME: string|undefined
    public readonly HEROKU_APP_ID: string|undefined
    public readonly HEROKU_RELEASE_VERSION: string|undefined
    public readonly HEROKU_SLUG_COMMIT: string|undefined
    public readonly HEROKU_RELEASE_CREATED_AT: string|undefined


    public readonly PORT: number
    public readonly TELEGRAM_TOKEN: string
    public readonly WEBHOOK_PORT: number
    public readonly REDIS_URL: string
    public readonly NODE_ENV: Envs
    public readonly DEBUG: string|undefined
    public readonly BOT_DISABLED: boolean

    /**
     * Chat used to receive user feedback and send reply to it.
     */
    public readonly SUPPORT_FEEDBACK_CHAT_ID?: number

    constructor() {
        this.DATABASE_URL = process.env.DATABASE_URL
        this.GOOGLE_ANALYTICS_ID = process.env.GOOGLE_ANALYTICS_ID
        this.GOOGLE_ANALYTICS_COUNT_ADMINS = !!process.env.GOOGLE_ANALYTICS_COUNT_ADMINS || false
        this.GOOGLE_DOCS_ID = process.env.GOOGLE_DOCS_ID

        this.HEROKU_APP_NAME = process.env.HEROKU_APP_NAME || 'localhost'
        this.HEROKU_APP_ID = process.env.HEROKU_APP_ID
        this.HEROKU_RELEASE_VERSION = process.env.HEROKU_RELEASE_VERSION
        this.HEROKU_SLUG_COMMIT = process.env.HEROKU_SLUG_COMMIT
        this.HEROKU_RELEASE_CREATED_AT = process.env.HEROKU_RELEASE_CREATED_AT

        this.PORT = +process.env.PORT
        this.TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN
        this.WEBHOOK_PORT = +process.env.WEBHOOK_PORT
        this.REDIS_URL = process.env.REDIS_URL
        this.NODE_ENV = process.env.NODE_ENV === undefined ? 'development' : process.env.NODE_ENV as Envs
        this.DEBUG = process.env.DEBUG
        this.BOT_DISABLED = !!process.env.BOT_DISABLED

        this.SUPPORT_FEEDBACK_CHAT_ID = +process.env.SUPPORT_FEEDBACK_CHAT_ID || undefined
    }
}

const botConfig = new BotConfig()

export { botConfig }