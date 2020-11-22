import pg_promise, { IDatabase, IInitOptions, IMain } from 'pg-promise'
import * as pg from 'pg-promise/typescript/pg-subset'
import { IConnectionParameters } from 'pg-promise/typescript/pg-subset'
import { CustomFilterRepository } from './custom-filter-repository'
import { EventsSyncRepository } from './sync-repository'
import { TopEventsRepository } from './top-events'
import { AdminRepository } from './db-admin'
import { SearchRepository } from './search'
import { UserRepository } from './db-users'
import { botConfig } from '../util/bot-config'
import { FeedbackRepository } from './db-feedbacks'
import { logger } from '../util/logger'
import pgMonitor from 'pg-monitor'

export interface IExtensions {
    repoSync: EventsSyncRepository,
    repoCustomEvents: CustomFilterRepository
    repoTopEvents: TopEventsRepository
    repoAdmin: AdminRepository
    repoSearch: SearchRepository
    userRepo: UserRepository
    repoFeedback: FeedbackRepository
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
        dbEx.repoFeedback = new FeedbackRepository(dbEx, pgp)
    },

    query(e) {
        // logger.silly(e.query)
    }

};


// attach to all pg-promise events of the initOptions object:


// Example of attaching to just events 'query' and 'error':
// monitor.attach(initOptions, ['query', 'error']);

const pgp: IMain = pg_promise(initOptions)

export function pgLogVerbose() {
    if (pgMonitor.isAttached()) {
        pgMonitor.detach()
    }
    pgMonitor.attach(initOptions, undefined);
}

export function pgLogOnlyErrors() {
    if (pgMonitor.isAttached()) {
        pgMonitor.detach()
    }
    pgMonitor.attach(initOptions, ['error']);
}

if (botConfig.NODE_ENV === 'development') {
    pgLogVerbose()
} else {
    pgLogOnlyErrors()
}

pgMonitor.setLog((msg, info) => {
    // botConfig.NODE_ENV === 'development'
    const text = process.stdout.isTTY ? info.colorText : info.text
    if (info.event === 'error') {
        logger.error(text)
    } else {
        logger.silly(text)
    }
    info.display = false
})

const dbCfg: IConnectionParameters<pg.IClient> & {} = {
    connectionString: botConfig.DATABASE_URL,
    max:
        +20,
    ssl: botConfig.HEROKU_APP_ID === undefined ? undefined : { rejectUnauthorized: false },
}

const db: BotDb = pgp(dbCfg); // database instance;

export { db, pgp, dbCfg }