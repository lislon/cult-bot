import pg_promise, { IDatabase, IInitOptions, IMain } from 'pg-promise'
import * as pg from 'pg-promise/typescript/pg-subset'
import { IConnectionParameters } from 'pg-promise/typescript/pg-subset'
import { Diagnostics } from './db/diagnostics'
import { CustomFilterRepository } from './db/custom-filter-repository'
import { EventsSyncRepository } from './db/sync-repository'
import { TopEventsRepository } from './db/top-events'
import { AdminRepository } from './db/db-admin'
import { SearchRepository } from './db/search'
import { UserRepository } from './db/db-users'
import { botConfig } from './util/bot-config'

export interface IExtensions {
    repoSync: EventsSyncRepository,
    repoCustomEvents: CustomFilterRepository
    repoTopEvents: TopEventsRepository
    repoAdmin: AdminRepository
    repoSearch: SearchRepository
    userRepo: UserRepository
}

export type BotDb = IDatabase<IExtensions> & IExtensions;

const initOptions: IInitOptions<IExtensions> = {

    extend(dbEx: BotDb) {
        dbEx.repoSync = new EventsSyncRepository(dbEx, pgp);
        dbEx.repoCustomEvents = new CustomFilterRepository(dbEx, pgp)
        dbEx.repoTopEvents = new TopEventsRepository(dbEx, pgp)
        dbEx.repoAdmin = new AdminRepository(dbEx, pgp)
        dbEx.repoSearch = new SearchRepository(dbEx, pgp)
        dbEx.userRepo = new UserRepository(dbEx, pgp)
    },

    query(e) {
        if (botConfig.DEBUG !== undefined) {
            console.log(e.query);
        }
    }

};


// attach to all pg-promise events of the initOptions object:


// Example of attaching to just events 'query' and 'error':
// monitor.attach(initOptions, ['query', 'error']);

const pgp: IMain = pg_promise(initOptions)

// monitor.attach(initOptions);
Diagnostics.init(initOptions)

const dbCfg: IConnectionParameters<pg.IClient> & {} = {
    connectionString: botConfig.DATABASE_URL,
    max: +20,
    ssl: botConfig.HEROKU_APP_ID === undefined ? undefined : { rejectUnauthorized: false },
}

const db: BotDb = pgp(dbCfg); // database instance;

export { db, pgp, dbCfg }
