import { config } from 'dotenv'

type Envs = 'development' | 'production' | 'test'

export class AppConfig {
    public HEROKU_APP_NAME: string | undefined
    public HEROKU_APP_ID: string | undefined
    public HEROKU_RELEASE_VERSION: string | undefined
    public HEROKU_SLUG_COMMIT: string | undefined
    public HEROKU_RELEASE_CREATED_AT: string | undefined

    public PORT: number | undefined
    public NODE_ENV: Envs | undefined

    public OKTA_OAUTH2_CLIENT_ID: string | undefined
    public OKTA_OAUTH2_CLIENT_SECRET: string | undefined
    public OKTA_OAUTH2_ISSUER: string | undefined
    public CULTHUB_BOT_API_URL: string | undefined
    public TELEGRAM_BOT_NAME: string | undefined
    public GOOGLE_MAPS_API_KEY: string | undefined



    constructor() {
        config()
        this.setFromKeyValue(process.env)
    }

    public get isProduction(): boolean {
        return this.HEROKU_APP_NAME?.endsWith('-prod') || false
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types
    public setFromKeyValue(envVars: any): void {
        this.HEROKU_APP_NAME = envVars.HEROKU_APP_NAME || 'localhost'
        this.HEROKU_APP_ID = envVars.HEROKU_APP_ID
        this.HEROKU_RELEASE_VERSION = envVars.HEROKU_RELEASE_VERSION
        this.HEROKU_SLUG_COMMIT = envVars.HEROKU_SLUG_COMMIT
        this.HEROKU_RELEASE_CREATED_AT = envVars.HEROKU_RELEASE_CREATED_AT

        this.PORT = +envVars.PORT
        this.NODE_ENV = envVars.NODE_ENV === undefined ? 'development' : envVars.NODE_ENV as Envs

        this.OKTA_OAUTH2_CLIENT_ID = process.env.OKTA_OAUTH2_CLIENT_ID || ''
        this.OKTA_OAUTH2_CLIENT_SECRET = process.env.OKTA_OAUTH2_CLIENT_SECRET || ''
        this.OKTA_OAUTH2_ISSUER = process.env.OKTA_OAUTH2_ISSUER || ''
        this.CULTHUB_BOT_API_URL = process.env.CULTHUB_BOT_API_URL || ''
        this.TELEGRAM_BOT_NAME = process.env.TELEGRAM_BOT_NAME || ''
        this.GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || ''
    }
}

const appConfig = new AppConfig()

export { appConfig }