process.env.NODE_ENV = process.env.NODE_ENV || 'test'
if (process.env.TEST_DATABASE_URL !== undefined) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
}