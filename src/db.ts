import pg_promise from 'pg-promise'
import { config } from 'dotenv'
import * as pg from 'pg-promise/typescript/pg-subset'
import { Diagnostics } from './db/diagnostics'
import { IDatabase, IInitOptions, IMain } from 'pg-promise'
import { IConnectionParameters } from 'pg-promise/typescript/pg-subset'
import { CustomFilterRepository } from './db/custom-filter-repository'
import { EventsSyncRepository } from './db/sync-repository'
import { TopEventsRepository } from './db/events'
import { AdminRepository } from './db/db-admin'

config();

export interface IExtensions {
    repoSync: EventsSyncRepository,
    repoCustomEvents: CustomFilterRepository
    repoTopEvents: TopEventsRepository
    repoAdmin: AdminRepository
}

export type BotDb = IDatabase<IExtensions> & IExtensions;

const initOptions: IInitOptions<IExtensions> = {

    extend(dbEx: BotDb) {
        dbEx.repoSync = new EventsSyncRepository(dbEx, pgp);
        dbEx.repoCustomEvents = new CustomFilterRepository(dbEx, pgp)
        dbEx.repoTopEvents = new TopEventsRepository(dbEx, pgp)
        dbEx.repoAdmin = new AdminRepository(dbEx, pgp);
    },

    // query(e) {
    //     console.log(e.query);
    // }

};


// attach to all pg-promise events of the initOptions object:


// Example of attaching to just events 'query' and 'error':
// monitor.attach(initOptions, ['query', 'error']);

const pgp: IMain = pg_promise(initOptions)

// monitor.attach(initOptions);
Diagnostics.init(initOptions)

const dbCfg: IConnectionParameters<pg.IClient> & {} = {
    connectionString: process.env.DATABASE_URL,
    max: +20,
    ssl: process.env.HEROKU_APP_ID === undefined ? undefined : { rejectUnauthorized: false },
}

const db: BotDb = pgp(dbCfg); // database instance;

export { db, pgp, dbCfg }
