import { config } from 'dotenv'
import Bottleneck from 'bottleneck'
import { ThrottlerOptions } from 'telegraf-throttler'

type Envs = 'development' | 'production' | 'test'

export class BotConfig {
    public DATABASE_URL: string
    public DATABASE_MAX_POOL: number
    public DATABASE_SSL: 'yes' | 'no'

    public GOOGLE_ANALYTICS_ID: string | undefined
    public GOOGLE_ANALYTICS_COUNT_ADMINS: boolean
    public GOOGLE_DOCS_ID: string
    public HEROKU_APP_NAME: string | undefined
    public HEROKU_APP_ID: string | undefined
    public HEROKU_RELEASE_VERSION: string | undefined
    public HEROKU_SLUG_COMMIT: string | undefined
    public HEROKU_RELEASE_CREATED_AT: string | undefined
    public HOLIDAYS: string

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

    // https://www.npmjs.com/package/telegraf-throttler
    public THROTTLE_IN_HIGH_WATER?: number
    public THROTTLE_IN_MAX_CONCURRENT?: number
    public THROTTLE_IN_MIN_TIME?: number
    public THROTTLE_IN_RESERVOIR?: number
    public THROTTLE_IN_REFRESH_AMOUNT?: number
    public THROTTLE_IN_REFRESH_INTERVAL?: number

    public THROTTLE_OUT_HIGH_WATER?: number
    public THROTTLE_OUT_MAX_CONCURRENT?: number
    public THROTTLE_OUT_MIN_TIME?: number
    public THROTTLE_OUT_RESERVOIR?: number
    public THROTTLE_OUT_REFRESH_AMOUNT?: number
    public THROTTLE_OUT_REFRESH_INTERVAL?: number

    public SCHEDULE_WEEKS_AGO: number
    public SCHEDULE_WEEKS_AHEAD: number

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

        this.HOLIDAYS = envVars.HOLIDAYS || ''

        this.SUPPORT_FEEDBACK_CHAT_ID = +envVars.SUPPORT_FEEDBACK_CHAT_ID || undefined
        this.MAILINGS_PER_WEEK_MAX = +envVars.MAILINGS_PER_WEEK_MAX || 2
        this.MAILINGS_PER_SECOND = +envVars.MAILINGS_PER_SECOND || 4
        this.LOG_PAGE_VIEWS_IN_DB = !!envVars.LOG_PAGE_VIEWS_IN_DB || true

        this.SLIDER_STATE_TTL_SECONDS = +envVars.SLIDER_STATE_TTL_SECONDS || 3600 * 8
        this.SLIDER_MAX_STATES_SAVED = +envVars.SLIDER_MAX_STATES_SAVED || 5
        this.SLIDER_MAX_IDS_CACHED = +envVars.SLIDER_MAX_IDS_CACHED || 10
        this.SLIDER_INSTA_VIEW = !!envVars.SLIDER_INSTA_VIEW || false
        this.DATABASE_SSL = envVars.DATABASE_SSL || 'yes'

        const number = (key: unknown, defaultValue: number|undefined): void => {
            if (envVars.key === undefined) {
                // @ts-expect-error: Later
                this[key] = defaultValue
            } else if (envVars.key === '') {
                // @ts-expect-error: Later
                this[key] = undefined
            } else {
                // @ts-expect-error: Later
                this[key] = +envVars.key
            }
        }

        number('THROTTLE_IN_HIGH_WATER', 3)             // Trigger strategy if throttler is not ready for a new job
        number('THROTTLE_IN_MAX_CONCURRENT', 1)         // Only 1 job at a time
        number('THROTTLE_IN_MIN_TIME', 333)             // Wait this many milliseconds to be ready, after a job
        number('THROTTLE_IN_RESERVOIR', undefined)
        number('THROTTLE_IN_REFRESH_AMOUNT', undefined)
        number('THROTTLE_IN_REFRESH_INTERVAL', undefined)

        number('THROTTLE_OUT_HIGH_WATER', undefined)
        number('THROTTLE_OUT_MAX_CONCURRENT', undefined)
        number('THROTTLE_OUT_MIN_TIME', 25)               // Wait this many milliseconds to be ready, after a job
        number('THROTTLE_OUT_RESERVOIR', 30)              // Number of new jobs that throttler will accept at start
        number('THROTTLE_OUT_REFRESH_AMOUNT', 30)         // Number of jobs that throttler will accept after refresh
        number('THROTTLE_OUT_REFRESH_INTERVAL', 1000)     // Interval in milliseconds where reservoir will refresh

        number('SCHEDULE_WEEKS_AGO', 2)
        number('SCHEDULE_WEEKS_AHEAD', 5)
    }

    get throttlerOptions(): ThrottlerOptions {
        return {
            in: {
                highWater: this.THROTTLE_IN_HIGH_WATER,
                maxConcurrent: this.THROTTLE_IN_MAX_CONCURRENT,
                minTime: this.THROTTLE_IN_MIN_TIME,
                reservoir: this.THROTTLE_IN_RESERVOIR,
                reservoirRefreshAmount: this.THROTTLE_IN_REFRESH_AMOUNT,
                reservoirRefreshInterval: this.THROTTLE_IN_REFRESH_INTERVAL,
                strategy: Bottleneck.strategy.LEAK,
            },
            out: {
                highWater: this.THROTTLE_OUT_HIGH_WATER,
                maxConcurrent: this.THROTTLE_OUT_MAX_CONCURRENT,
                minTime: this.THROTTLE_OUT_MIN_TIME,
                reservoir: this.THROTTLE_OUT_RESERVOIR,
                reservoirRefreshAmount: this.THROTTLE_OUT_REFRESH_AMOUNT,
                reservoirRefreshInterval: this.THROTTLE_OUT_REFRESH_INTERVAL,
            }
        }
    }
}

const botConfig = new BotConfig()

export { botConfig }
