import { db, IExtensions, pgp } from '../database/db'
import { logger } from '../util/logger'
import { parseAndPredictTimetable } from '../lib/timetable/timetable-utils'
import { ITask } from 'pg-promise'
import { keyBy } from 'lodash'
import { EventForRefresh } from '../database/db-sync-repository'
import { isEqual } from 'date-fns'

async function refreshDates() {
    const now = new Date()
    try {
        await db.tx(async (dbTx: ITask<IExtensions> & IExtensions) => {
            const allEvents: EventForRefresh[] = await dbTx.repoSync.getLastEventDates()
            const lastEventDateByIds: { [key: string]: EventForRefresh } = keyBy(allEvents, 'id')

            const eventsToUpdate = allEvents
                .map(e => {
                    return {
                        id: e.id,
                        timeIntervals: parseAndPredictTimetable(e.timetable, now).timeIntervals
                    }
                })
                .filter(({id, timeIntervals}) => {
                    if (timeIntervals.length === 0) {
                        return true;
                    }
                    const i = timeIntervals[timeIntervals.length - 1]
                    const lastInterval = (Array.isArray(i) ? i[1] : i)
                    if (isEqual(lastInterval, lastEventDateByIds[id].lastDate)) {
                        return false
                    }
                    return true
                })
            if (eventsToUpdate.length > 0) {
                logger.info(`RefreshDates: updated ${eventsToUpdate.length}: ` + eventsToUpdate.map(e => e.id).join(','))
                await dbTx.repoSync.syncEventIntervals(dbTx, eventsToUpdate)
            } else {
                logger.info(`RefreshDates: all ${allEvents.length} events are fresh`)
            }
            await dbTx.repoSync.shuffle()
        })
    } catch (e) {
        logger.error(e)
    }
}

(async function run() {
    logger.debug(`RefreshDates: start refreshing...`)
    await refreshDates()
    pgp.end()
})()

