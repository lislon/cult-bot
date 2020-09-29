import pg_promise, * as pgPromise from 'pg-promise'
import { config } from 'dotenv'
import monitor from 'pg-monitor'
import * as pg from 'pg-promise/typescript/pg-subset'

config();

const initOptions: pgPromise.IInitOptions<{}, pg.IClient> = {
    // query(e) {
    //     console.log(e.query);
    //     //console.log(`${process.pid}: ${e.query}`);
    // }
};


// attach to all pg-promise events of the initOptions object:


// Example of attaching to just events 'query' and 'error':
// monitor.attach(initOptions, ['query', 'error']);

const pgp = pg_promise(initOptions)

monitor.attach(initOptions);

const dbCfg = {
    connectionString: process.env.DATABASE_URL,
    max: +20,
    ssl: process.env.HEROKU_APP_ID === undefined ? undefined : { rejectUnauthorized: false },

}

const db = pgp(dbCfg); // database instance;

export { db, pgp, dbCfg }
