import { ParsedEventToSave } from '../database/parsed-event'
import { ITask } from 'pg-promise'
import { saveCurrentToExcel } from '../lib/export-to-excel'
import { authToExcel } from '@culthub/google-docs'
import { appConfig } from '../app-config'
import { filterOnlyBotSpecificEvents } from '../lib/filter-logic'
import { db } from '../database/db'
import { getNextWeekendDates } from '../lib/cron-common'
import debugNamespace from 'debug'
import { afishaDownload } from '../lib/afisha-download'
import { logger } from '../logger'
import { format } from 'date-fns'


const debug = debugNamespace('yandex-parser');


(async function () {
    try {
        const dates = getNextWeekendDates(new Date())

        logger.info(`parse-base: ${dates.map(d => format(d, 'MMMM dd')).join(', ')}...`)
        const allEvents = await afishaDownload(dates, { limitEvents: appConfig.LIMIT_EVENTS_PER_PARSE, snapshotDirectory: appConfig.JSON_SNAPSHOT_DIR })
        const newEvents: ParsedEventToSave[] = filterOnlyBotSpecificEvents(allEvents)

        logger.debug(`Saving ${newEvents.length} interesting events to database (${allEvents.length} total)`)
        const diff = await db.task(async (t: ITask<unknown>) => {
            // const newEventsWithDates = await enrichEventsWithPastDates(newEvents, new Date(), t)

            const diff = await db.repoSync.prepareDiffForSync(newEvents, t)
            return await db.repoSync.syncDiff(diff, t)
        })

        logger.debug(`Updating excel...`)
        const parsedEventToRecovers = ([...diff.recovered, ...diff.updated, ...diff.inserted, ...diff.notChanged])
        const excel = await authToExcel(appConfig.GOOGLE_AUTH_FILE)
        await saveCurrentToExcel(excel, parsedEventToRecovers.map(e => e.primaryData), dates)
        await db.$pool.end()
        logger.info(`Success. ${parsedEventToRecovers.length} saved`)
    } catch (e) {
        logger.error(e)
        process.exit(1)
    }
})()