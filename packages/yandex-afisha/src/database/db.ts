import pg_promise, { IDatabase, IInitOptions, IMain } from 'pg-promise'
import * as pg from 'pg-promise/typescript/pg-subset'
import { IConnectionParameters } from 'pg-promise/typescript/pg-subset'
import { appConfig } from '../app-config'
import { ParsedEventRepository } from './parsed-event'

export interface IExtensions {
     repoSync: ParsedEventRepository,
}

export type BotDb = IDatabase<IExtensions> & IExtensions;

const initOptions: IInitOptions<IExtensions> = {

    extend(dbEx: BotDb) {
        dbEx.repoSync = new ParsedEventRepository(dbEx, pgp)
    },

    query() {
        // console.log(e.query)
    }
}

const pgp: IMain = pg_promise(initOptions)

const dbCfg: IConnectionParameters<pg.IClient> = {
    connectionString: appConfig.DATABASE_URL,
    max: appConfig.DATABASE_MAX_POOL,
    ssl: appConfig.DATABASE_SSL === 'yes' ? {rejectUnauthorized: false} : undefined,
}

const db: BotDb = pgp(dbCfg) // database instance;

export { db, pgp, dbCfg }