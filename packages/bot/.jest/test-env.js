process.env.NODE_ENV = 'test'
process.env.GOOGLE_ANALYTICS_ID = undefined
process.env.SUPPORT_FEEDBACK_CHAT_ID = 123

if (process.env.TEST_DATABASE_URL !== undefined) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
}