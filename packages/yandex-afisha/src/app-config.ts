import { config } from 'dotenv'
import path from 'path'

type Envs = 'development' | 'production' | 'test'

export class AppConfig {
    public DATABASE_URL: string
    public DATABASE_MAX_POOL: number
    public DATABASE_SSL: 'yes' | 'no'

    // public GOOGLE_ANALYTICS_ID: string | undefined
    // public GOOGLE_ANALYTICS_COUNT_ADMINS: boolean
    // public GOOGLE_DOCS_ID: string
    public HEROKU_APP_NAME: string | undefined
    public HEROKU_APP_ID: string | undefined
    public HEROKU_RELEASE_VERSION: string | undefined
    public HEROKU_SLUG_COMMIT: string | undefined
    public HEROKU_RELEASE_CREATED_AT: string | undefined

    public PORT: number
    public NODE_ENV: Envs
    public readonly GOOGLE_AUTH_FILE = path.resolve(__dirname, '../secrets/culthubbot-google-account.json')
    public readonly SECONDS_PER_PAGE = 17
    public JSON_SNAPSHOT_DIR: string | undefined
    public LIMIT_EVENTS_PER_PARSE?: number
    public MAILGUN_API_KEY: string

    public OKTA_OAUTH2_CLIENT_ID: string
    public OKTA_OAUTH2_CLIENT_SECRET: string
    public OKTA_OAUTH2_ISSUER: string
    public CULTHUB_BOT_API_URL: string
    public GOOGLE_DOCS_ID: string


    constructor() {
        config()
        this.setFromKeyValue(process.env)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types
    public setFromKeyValue(envVars: any): void {
        this.DATABASE_URL = envVars.DATABASE_URL
        this.DATABASE_MAX_POOL = envVars.DATABASE_MAX_POOL === undefined ? 18 : +envVars.DATABASE_MAX_POOL

        this.HEROKU_APP_NAME = envVars.HEROKU_APP_NAME || 'localhost'
        this.HEROKU_APP_ID = envVars.HEROKU_APP_ID
        this.HEROKU_RELEASE_VERSION = envVars.HEROKU_RELEASE_VERSION
        this.HEROKU_SLUG_COMMIT = envVars.HEROKU_SLUG_COMMIT
        this.HEROKU_RELEASE_CREATED_AT = envVars.HEROKU_RELEASE_CREATED_AT

        this.PORT = +envVars.PORT
        this.NODE_ENV = envVars.NODE_ENV === undefined ? 'development' : envVars.NODE_ENV as Envs
        this.DATABASE_SSL = envVars.DATABASE_SSL || 'yes'
        this.LIMIT_EVENTS_PER_PARSE = envVars.LIMIT_EVENTS_PER_PARSE || undefined
        this.JSON_SNAPSHOT_DIR = envVars.JSON_SNAPSHOT_DIR || undefined
        this.MAILGUN_API_KEY = envVars.MAILGUN_API_KEY || undefined
        this.OKTA_OAUTH2_CLIENT_ID = envVars.OKTA_OAUTH2_CLIENT_ID || ''
        this.OKTA_OAUTH2_CLIENT_SECRET = envVars.OKTA_OAUTH2_CLIENT_SECRET || ''
        this.OKTA_OAUTH2_ISSUER = envVars.OKTA_OAUTH2_ISSUER || ''
        this.CULTHUB_BOT_API_URL = envVars.CULTHUB_BOT_API_URL || ''
        this.GOOGLE_DOCS_ID = envVars.GOOGLE_DOCS_ID || ''


    }
}

const appConfig = new AppConfig()

export { appConfig }
