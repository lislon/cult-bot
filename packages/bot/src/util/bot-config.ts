import { config } from 'dotenv'
import Bottleneck from 'bottleneck'
import { ThrottlerOptions } from 'telegraf-throttler'
import path from 'path'

type Envs = 'development' | 'production' | 'test'

type TagStyle = 'none' | 'A' | 'B' | 'C' | 'D'

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
    public LISTEN_DIRECT_ON_HTTPS: boolean
    public DIRECT_HTTPS_CERT_PATH = 'packages/bot/secrets/ssl4debug/key.pem'
    public DIRECT_HTTPS_KEY_PATH = 'packages/bot/secrets/ssl4debug/cert.pem'
    public DIRECT_HTTPS_KEY_PASS= 'lisalisa'

    public PORT: number
    public TELEGRAM_TOKEN: string
    public TELEGRAM_BOT_NAME: string
    public WEBHOOK_HOST: string
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

    /**
     * How long slider will remain workable (left/right buttons for user).
     */
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
    public DROP_PENDING_UPDATES: boolean


    get SCHEDULE_DAYS_AGO(): number {
        return this.SCHEDULE_WEEKS_AGO * 7
    }
    get SCHEDULE_DAYS_AHEAD(): number {
        return this.SCHEDULE_WEEKS_AHEAD * 7
    }

    public YANDEX_AFISHA_URL?: string
    public readonly GOOGLE_AUTH_FILE = path.resolve(__dirname, '../../secrets/culthubbot-google-account.json')
    /**
     * Default threshold number of events. When packs contains number of events below threshold it will be hidden.
     */
    public readonly DEFAULT_PACK_HIDE_WHEN_LESS_THEN_EVENTS = 2

    public FEATURE_GEO: boolean

    /**
     * Values which should be taken from okta.com plugin. These allow to verify client API calls.
     */
    public OKTA_OAUTH2_CLIENT_ID: string
    public OKTA_OAUTH2_ISSUER: string
    public OKTA_OAUTH2_ENABLED: boolean

    /**
     * Chat used to receive user feedback and send reply to it.
     */
    public SUPPORT_FEEDBACK_CHAT_ID?: number
    /**
     * For how long list of packs will be cached before re-fetch from db.
     */
    public PACKS_CACHE_TTL_SECONDS: number

    public AGRESSIVE_LOG: boolean

    /**
     * Monitoring tool
     */
    public SENTRY_DSN: string
    public SENTRY_SAMPLE_RATE: number


    constructor() {
        config()
        this.setFromKeyValue(process.env)
    }

    public setFromKeyValue(envVars: any) {

        const boolean = (key: unknown, defaultValue: boolean | undefined): void => {
            // @ts-expect-error: Later
            if (envVars[key] === undefined) {
                // @ts-expect-error: Later
                this[key] = defaultValue
                // @ts-expect-error: Later
            } else if (envVars[key] === '') {
                // @ts-expect-error: Later
                this[key] = undefined
                // @ts-expect-error: Later
            } else if (typeof envVars[key] === 'string' && (envVars[key].toLowerCase() === 'yes' || envVars[key].toLowerCase() === 'true')) {
                // @ts-expect-error: Later
                this[key] = true
            } else {
                // @ts-expect-error: Later
                this[key] = false
            }

        }

        const number = (key: unknown, defaultValue: number | undefined): void => {
            // @ts-expect-error: Later
            if (envVars[key] === undefined) {
                // @ts-expect-error: Later
                this[key] = defaultValue
                // @ts-expect-error: Later
            } else if (envVars[key] === '') {
                // @ts-expect-error: Later
                this[key] = undefined
            } else {
                // @ts-expect-error: Later
                this[key] = +envVars[key]
            }
        }

        const string = (key: unknown, defaultValue: string | undefined = undefined): void => {
            // @ts-expect-error: Later
            if (envVars[key] === undefined) {
                // @ts-expect-error: Later
                this[key] = defaultValue
                // @ts-expect-error: Later
            } else if (envVars[key] === '') {
                // @ts-expect-error: Later
                this[key] = undefined
            } else {
                // @ts-expect-error: Later
                this[key] = envVars[key]
            }
        }

        this.DATABASE_URL = envVars.DATABASE_URL
        this.DATABASE_MAX_POOL = envVars.DATABASE_MAX_POOL === undefined ? 18 : +envVars.DATABASE_MAX_POOL
        this.DATABASE_SSL = envVars.DATABASE_SSL || 'yes'

        this.GOOGLE_ANALYTICS_ID = envVars.GOOGLE_ANALYTICS_ID
        this.GOOGLE_ANALYTICS_COUNT_ADMINS = !!envVars.GOOGLE_ANALYTICS_COUNT_ADMINS || false
        this.GOOGLE_DOCS_ID = envVars.GOOGLE_DOCS_ID

        string('HEROKU_APP_NAME', 'localhost')
        string('HEROKU_APP_ID', '')
        string('HEROKU_RELEASE_VERSION', 'local')
        string('HEROKU_SLUG_COMMIT')
        string('HEROKU_RELEASE_CREATED_AT')
        string('SENTRY_DSN', '')
        number('SENTRY_SAMPLE_RATE', 1.0)

        this.OKTA_OAUTH2_CLIENT_ID = envVars.OKTA_OAUTH2_CLIENT_ID
        this.OKTA_OAUTH2_ISSUER = envVars.OKTA_OAUTH2_ISSUER
        boolean('OKTA_OAUTH2_ENABLED', true)


        this.TELEGRAM_TOKEN = envVars.TELEGRAM_TOKEN
        this.TELEGRAM_BOT_NAME = envVars.TELEGRAM_BOT_NAME || 'CultHubBot'

        number('PORT', 0)
        number('WEBHOOK_PORT', 0)
        this.REDIS_URL = envVars.REDIS_URL
        number('REDIS_TTL', 3600 * 24 * 30)

        this.NODE_ENV = envVars.NODE_ENV === undefined ? 'development' : envVars.NODE_ENV as Envs
        this.DEBUG = envVars.DEBUG
        this.BOT_DISABLED = !!envVars.BOT_DISABLED
        this.LOG_LEVEL = envVars.LOG_LEVEL
        if (this.LOG_LEVEL === undefined) {
            this.LOG_LEVEL = (this.NODE_ENV === 'production' || this.NODE_ENV === 'test') ? 'info' : 'debug'
        }

        this.HOLIDAYS = envVars.HOLIDAYS || ''

        number('SUPPORT_FEEDBACK_CHAT_ID', undefined)
        number('MAILINGS_PER_WEEK_MAX', 2)
        number('MAILINGS_PER_SECOND', 4)
        number('SLIDER_STATE_TTL_SECONDS', 3600 * 8)
        number('PACKS_CACHE_TTL_SECONDS', 5 * 60)
        number('SLIDER_MAX_STATES_SAVED', 5)
        number('SLIDER_MAX_IDS_CACHED', 10)

        boolean('LOG_PAGE_VIEWS_IN_DB', true)
        boolean('FEATURE_GEO', false)
        boolean('SLIDER_INSTA_VIEW', false)
        this.YANDEX_AFISHA_URL = envVars.YANDEX_AFISHA_URL

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

        boolean('DROP_PENDING_UPDATES', false)
        boolean('AGRESSIVE_LOG', false)
        boolean('LISTEN_DIRECT_ON_HTTPS', false)

        this.WEBHOOK_HOST = envVars.WEBHOOK_HOST || `${this.HEROKU_APP_NAME}.herokuapp.com`
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
