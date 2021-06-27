import { db, pgp } from '../database/db'
import { logger } from '../util/logger'

(async function run() {
    logger.debug(`Reset mailing counters to 0`)
    await db.repoUser.resetMailingCounter()
    logger.info(`Reset mailing counters done`)
    pgp.end()
})()