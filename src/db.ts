import pg_promise from 'pg-promise'
import { config } from 'dotenv'

config();

const pgp = pg_promise({
    capSQL: true,
})

const cfg = {
    host: process.env.PGHOST,
    port: +process.env.PGPORT,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    max: +process.env.PGMAXCONNECTIONS
}

const db = pgp(cfg); // database instance;

export { db }