import pg_promise from 'pg-promise'
import { config } from 'dotenv'

config();

const pgp = pg_promise({})

const dbCfg = {
    connectionString: process.env.NODE_ENV === 'test' ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL,
    max: +20,
    ssl: process.env.HEROKU_APP_ID === undefined ? undefined : { rejectUnauthorized: false }
}

console.log('db')
console.log(process.env.NODE_ENV)
console.log(dbCfg)

const db = pgp(dbCfg); // database instance;
export { db, pgp, dbCfg }