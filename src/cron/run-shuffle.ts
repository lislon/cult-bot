import { db, pgp } from '../database/db'
import { logger } from '../util/logger'

(async function run() {
    logger.info('Shuffle events...')
    await db.none('update cb_events set order_rnd = CEIL(random() * 1000000)')
    logger.info('Success!')
    pgp.end()
})()

