import pg_promise, * as pgPromise from 'pg-promise'
import { config } from 'dotenv'
import monitor from 'pg-monitor'
import * as pg from 'pg-promise/typescript/pg-subset'

config();

const initOptions: pgPromise.IInitOptions<{}, pg.IClient> = {};

const pgp = pg_promise(initOptions)

monitor.attach(initOptions);

const dbCfg = {
    connectionString: process.env.DATABASE_URL,
    max: +1,
    ssl: process.env.HEROKU_APP_ID === undefined ? undefined : { rejectUnauthorized: false },

}

const db = pgp(dbCfg); // database instance;

export { db, pgp, dbCfg }

(async () => {
    // const d = await db.task(async (t) => {
    //     const events = await t.query('select 1 + 1');
    //     return events
    // })
    //
    // console.log('qq')
    // // db.$pool.end()
    // pgp.end()
})()
//
describe('Sorting & Paging', () => {
    test('Sorting', async () => {
        const d = await db.task(async (t) => {
            const events = await t.one('select 1 + 1 AS q');
            return events
        })

        console.log('qq')
        expect(d['q']).toEqual(2)


        // done()

    }, 10000)
})
afterAll(async done => {
    // Closing the DB connection allows Jest to exit successfully.
    db.$pool.end()
    done();
});

// describe('Sorting & Paging', () => {
//
//     test('Sorting', async () => {
//         const d = await db.task(async (t) => {
//             const events = await t.query('select 1 + 1');
//             return events
//         })
//
//
//         expect(d).toEqual(2)
//         db.$pool.end()
//     }, 1000000)
//
// })