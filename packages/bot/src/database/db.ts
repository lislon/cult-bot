import pg_promise, { IDatabase, IInitOptions, IMain } from 'pg-promise'
import * as pg from 'pg-promise/typescript/pg-subset'
import { IConnectionParameters } from 'pg-promise/typescript/pg-subset'
import { TopEventsRepository } from './db-top-events'
import { AdminRepository } from './db-admin'
import { SearchRepository } from './search'
import { UserRepository } from './db-users'
import { botConfig } from '../util/bot-config'
import { FeedbackRepository } from './db-feedbacks'
import { logger } from '../util/logger'
import pgMonitor from 'pg-monitor'
import { SnapshotRepository } from './db-snapshot'
import { EventsSyncRepository } from './db-sync-repository'
import { PacksRepository } from './db-packs'
import { EventsCommonRepository } from './db-events-common'
import { LikesRepository } from './db-likes'
import { EventsGeoRepository } from './db-events-geo'
import { EventsMatchingRepository } from './db-event-matching'
import d from 'debug'
import { DbCustomizeRepository } from './db-customize-repository'
import { PlacesRepository } from './db-places'
import { ReferralRepository } from './db-referral'
import { ReferralVisitRepository } from './db-referral-visits'
import { assign } from 'lodash'

const debug = d('bot:sql')

export interface IExtensions {
    repoSync: EventsSyncRepository,
    repoCustomEvents: DbCustomizeRepository
    repoTopEvents: TopEventsRepository
    repoAdmin: AdminRepository
    repoSearch: SearchRepository
    repoSnapshot: SnapshotRepository
    repoUser: UserRepository
    repoReferral: ReferralRepository
    repoReferralVisit: ReferralVisitRepository
    repoFeedback: FeedbackRepository
    repoPacks: PacksRepository
    repoEventsCommon: EventsCommonRepository
    repoEventsGeo: EventsGeoRepository
    repoEventsMatching: EventsMatchingRepository
    repoLikes: LikesRepository
    repoPlaces: PlacesRepository
}

export type BotDb = IDatabase<IExtensions> & IExtensions;

const initOptions: IInitOptions<IExtensions> = {

    extend(dbEx: BotDb) {
        const extensions: IExtensions = {
            repoSync: new EventsSyncRepository(dbEx, pgp),
            repoCustomEvents: new DbCustomizeRepository(dbEx, pgp),
            repoTopEvents: new TopEventsRepository(dbEx, pgp),
            repoAdmin: new AdminRepository(dbEx, pgp),
            repoSearch: new SearchRepository(dbEx, pgp),
            repoUser: new UserRepository(dbEx, pgp),
            repoFeedback: new FeedbackRepository(dbEx, pgp),
            repoSnapshot: new SnapshotRepository(dbEx, pgp),
            repoPacks: new PacksRepository(dbEx, pgp),
            repoEventsCommon: new EventsCommonRepository(dbEx, pgp),
            repoLikes: new LikesRepository(dbEx, pgp),
            repoEventsGeo: new EventsGeoRepository(dbEx, pgp),
            repoEventsMatching: new EventsMatchingRepository(dbEx, pgp),
            repoPlaces: new PlacesRepository(dbEx, pgp),
            repoReferral: new ReferralRepository(dbEx, pgp),
            repoReferralVisit: new ReferralVisitRepository(dbEx, pgp),
        };
        assign(dbEx, extensions)
    },

    query(e) {
        debug('%s', e.query)
    }

}


const pgp: IMain = pg_promise(initOptions)

export function pgLogVerbose() {
    if (pgMonitor.isAttached()) {
        pgMonitor.detach()
    }
    pgMonitor.attach(initOptions, undefined)
}

export function pgLogOnlyErrors() {
    if (pgMonitor.isAttached()) {
        pgMonitor.detach()
    }
    pgMonitor.attach(initOptions, ['error'])
}

if (botConfig.NODE_ENV === 'production') {
    pgLogOnlyErrors()
} else {
    pgLogVerbose()
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

const dbCfg: IConnectionParameters<pg.IClient> = {
    connectionString: botConfig.DATABASE_URL,
    max: botConfig.DATABASE_MAX_POOL,
    ssl: botConfig.DATABASE_SSL === 'yes' ? {rejectUnauthorized: false} : undefined,
}

const db: BotDb = pgp(dbCfg) // database instance;

export { db, pgp, dbCfg }

export interface LimitOffset {
    limit: number
    offset: number
}

export interface LimitOffsetLast<T = number> extends LimitOffset {
    lastId: T
}