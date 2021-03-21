import { db, IExtensions, pgp } from '../database/db'
import { logger } from '../util/logger'
import { parseAndPredictTimetable } from '../lib/timetable/timetable-utils'
import { ITask } from 'pg-promise'
import { keyBy } from 'lodash'
import { EventForRefresh } from '../database/db-sync-repository'
import { isEqual } from 'date-fns'
import { botConfig } from '../util/bot-config'
import { autoAppendLastChanceTags, LAST_CHANCE_PREDICT_CONFIG } from '../core/last-chance'
import { notEmpty } from '../util/misc-utils'

async function updateIntervals(allEvents: EventForRefresh[], now: Date, lastEventDateByIds: { [p: string]: EventForRefresh }, dbTx: ITask<IExtensions> & IExtensions) {
    const eventsToUpdate = allEvents
        .map(e => {
            return {
                eventId: e.id,
                timeIntervals: parseAndPredictTimetable(e.timetable, now, botConfig).predictedIntervals
            }
        })
        .filter(({eventId, timeIntervals}) => {
            if (timeIntervals.length === 0) {
                return true
            }
            const i = timeIntervals[timeIntervals.length - 1]
            const lastInterval = (Array.isArray(i) ? i[1] : i)
            return !isEqual(lastInterval, lastEventDateByIds[eventId].lastDate)
        })
    if (eventsToUpdate.length > 0) {
        logger.info(`RefreshDates: updated ${eventsToUpdate.length}: ` + eventsToUpdate.map(e => e.eventId).join(','))
        await dbTx.repoSync.syncEventIntervals(eventsToUpdate, dbTx)
    } else {
        logger.info(`RefreshDates: all ${allEvents.length} events are fresh`)
    }
}

async function updateLastChance(allEvents: EventForRefresh[], now: Date, dbTx: ITask<IExtensions> & IExtensions) {
    const updateTags = allEvents.map(e => {

        const {predictedIntervals, parsedTimetable} = parseAndPredictTimetable(e.timetable, now, LAST_CHANCE_PREDICT_CONFIG)

        if (parsedTimetable !== undefined) {
            const updatedTagLevel2 = autoAppendLastChanceTags({
                predictedIntervals,
                parsedTimetable,
                now,
                tagLevel2: e.tagLevel2,
                category: e.category
            })
            if (updatedTagLevel2 !== e.tagLevel2) {
                return {id: e.id, tagLevel2: updatedTagLevel2}
            }
        }
        return undefined
    }).filter(notEmpty)

    await dbTx.repoSync.updateTagsLevel2(updateTags, dbTx)
}

async function refreshDates() {
    const now = new Date()
    try {
        await db.tx(async (dbTx: ITask<IExtensions> & IExtensions) => {
            const allEvents: EventForRefresh[] = await dbTx.repoSync.getEventsForRefresh()
            const lastEventDateByIds: { [key: string]: EventForRefresh } = keyBy(allEvents, 'id')

            await updateIntervals(allEvents, now, lastEventDateByIds, dbTx)
            await updateLastChance(allEvents, now, dbTx)

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

