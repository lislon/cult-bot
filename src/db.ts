import pg_promise from 'pg-promise'
import { config } from 'dotenv'

config();

const pgp = pg_promise({})

const cfg = {
    connectionString: process.env.DATABASE_URL,
    max: +20,
    ssl: process.env.HEROKU_APP_ID === undefined ? undefined : { rejectUnauthorized: false }
}


const db = pgp(cfg); // database instance;
export { db, pgp }