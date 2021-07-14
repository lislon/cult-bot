import { db, pgp } from '../database/db'
import { logger } from '../util/logger'
import { getLatLngByGeoTag } from '../lib/yandex-maps/lat-lng-updater'
import { sleep } from '../util/scene-utils'

(async function run() {
    logger.debug(`Updating events lat lng`)
    const geoEvents = await db.repoEventsGeo.getOfflineEventsWithMissingLatLng(100)
    for (const {id, geotag} of geoEvents) {
        logger.info(`${id} => ${geotag}`)
        const point = await getLatLngByGeoTag(geotag)
        if (point !== undefined) {
            await db.repoEventsGeo.saveLatLng([{
                id,
                point
            }])
            logger.info(`saved!`)
        } else {
            logger.warn(`oops, cant find for ${geotag}`)
        }
        await sleep(10000)
    }

    pgp.end()
})()