import { config } from 'dotenv'

type Envs = 'development' | 'production' | 'test'

export class BotConfig {
    public DATABASE_URL: string
    public DATABASE_MAX_POOL: number
    public GOOGLE_ANALYTICS_ID: string | undefined
    public GOOGLE_ANALYTICS_COUNT_ADMINS: boolean
    public GOOGLE_DOCS_ID: string
    public HEROKU_APP_NAME: string | undefined
    public HEROKU_APP_ID: string | undefined
    public HEROKU_RELEASE_VERSION: string | undefined
    public HEROKU_SLUG_COMMIT: string | undefined
    public HEROKU_RELEASE_CREATED_AT: string | undefined


    public PORT: number
    public TELEGRAM_TOKEN: string
    public WEBHOOK_PORT: number
    public REDIS_URL: string
    public REDIS_TTL: number
    public NODE_ENV: Envs
    public DEBUG: string | undefined
    public BOT_DISABLED: boolean
    public LOG_LEVEL: string

    public MAILINGS_PER_WEEK_MAX: number
    public MAILINGS_PER_SECOND: number
    public LOG_PAGE_VIEWS_IN_DB: boolean

    public SLIDER_STATE_TTL_SECONDS: number
    public SLIDER_MAX_STATES_SAVED: number
    public SLIDER_MAX_IDS_CACHED: number
    public SLIDER_INSTA_VIEW: boolean


    /**
     * Chat used to receive user feedback and send reply to it.
     */
    public SUPPORT_FEEDBACK_CHAT_ID?: number

    constructor() {
        config()
        this.setFromKeyValue(process.env)
    }

    public setFromKeyValue(envVars: any) {
        this.DATABASE_URL = envVars.DATABASE_URL
        this.DATABASE_MAX_POOL = envVars.DATABASE_MAX_POOL === undefined ? 18 : +envVars.DATABASE_MAX_POOL

        this.GOOGLE_ANALYTICS_ID = envVars.GOOGLE_ANALYTICS_ID
        this.GOOGLE_ANALYTICS_COUNT_ADMINS = !!envVars.GOOGLE_ANALYTICS_COUNT_ADMINS || false
        this.GOOGLE_DOCS_ID = envVars.GOOGLE_DOCS_ID

        this.HEROKU_APP_NAME = envVars.HEROKU_APP_NAME || 'localhost'
        this.HEROKU_APP_ID = envVars.HEROKU_APP_ID
        this.HEROKU_RELEASE_VERSION = envVars.HEROKU_RELEASE_VERSION
        this.HEROKU_SLUG_COMMIT = envVars.HEROKU_SLUG_COMMIT
        this.HEROKU_RELEASE_CREATED_AT = envVars.HEROKU_RELEASE_CREATED_AT

        this.PORT = +envVars.PORT
        this.TELEGRAM_TOKEN = envVars.TELEGRAM_TOKEN
        this.WEBHOOK_PORT = +envVars.WEBHOOK_PORT
        this.REDIS_URL = envVars.REDIS_URL
        this.REDIS_TTL = envVars.REDIS_TTL === undefined ? 3600 * 24 * 30 : +envVars.REDIS_TTL

        this.NODE_ENV = envVars.NODE_ENV === undefined ? 'development' : envVars.NODE_ENV as Envs
        this.DEBUG = envVars.DEBUG
        this.BOT_DISABLED = !!envVars.BOT_DISABLED
        this.LOG_LEVEL = envVars.LOG_LEVEL
        if (this.LOG_LEVEL === undefined) {
            this.LOG_LEVEL = (this.NODE_ENV === 'production' || this.NODE_ENV === 'test') ? 'info' : 'debug'
        }

        this.SUPPORT_FEEDBACK_CHAT_ID = +envVars.SUPPORT_FEEDBACK_CHAT_ID || undefined
        this.MAILINGS_PER_WEEK_MAX = +envVars.MAILINGS_PER_WEEK_MAX || 2
        this.MAILINGS_PER_SECOND = +envVars.MAILINGS_PER_SECOND || 4
        this.LOG_PAGE_VIEWS_IN_DB = !!envVars.LOG_PAGE_VIEWS_IN_DB || true

        this.SLIDER_STATE_TTL_SECONDS = +envVars.SLIDER_STATE_TTL_SECONDS || 3600 * 8
        this.SLIDER_MAX_STATES_SAVED = +envVars.SLIDER_MAX_STATES_SAVED || 5
        this.SLIDER_MAX_IDS_CACHED = +envVars.SLIDER_MAX_IDS_CACHED || 10
        this.SLIDER_INSTA_VIEW = !!envVars.SLIDER_INSTA_VIEW || false
    }
}

const botConfig = new BotConfig()

export { botConfig }
