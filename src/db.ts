import pg_promise from 'pg-promise'
import { config } from 'dotenv'

config();

const pgp = pg_promise({
    // query(e) {
    //     console.log(e.query);
    // }
})

const dbCfg = {
    connectionString: process.env.DATABASE_URL,
    max: +20,
    ssl: process.env.HEROKU_APP_ID === undefined ? undefined : { rejectUnauthorized: false }
}

const db = pgp(dbCfg); // database instance;
export { db, pgp, dbCfg }