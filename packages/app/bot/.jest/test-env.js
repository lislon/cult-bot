process.env.NODE_ENV = 'test'
process.env.GOOGLE_ANALYTICS_ID = undefined
process.env.SUPPORT_FEEDBACK_CHAT_ID = 123
process.env.BILLING_TINKOFF_PASSWORD_ENABLED = true
process.env.FEATURE_BILLING = false

if (process.env.TEST_DATABASE_URL !== undefined) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
}