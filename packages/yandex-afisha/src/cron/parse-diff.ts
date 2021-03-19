import { ParsedEventToSave } from '../database/parsed-event'
import { ITask } from 'pg-promise'
import { saveDiffToExcel } from '../lib/export-to-excel'
import { authToExcel } from '@culthub/google-docs'
import { appConfig } from '../app-config'
import { filterOnlyBotSpecificEvents } from '../lib/filter-logic'
import { db } from '../database/db'
import { getNextWeekendDates } from '../lib/cron-common'
import debugNamespace from 'debug'
import { afishaDownload } from '../lib/afisha-download'
import { logger } from '../logger'
import { format } from 'date-fns'
import { prepareDiffReport } from '../lib/diff-logic'

const debug = debugNamespace('yandex-parser');

(async function () {
    try {
        const dates = getNextWeekendDates(new Date())
        logger.info(`parse-diff: ${dates.map(d => format(d, 'MMMM dd')).join(', ')}...`)

        const allEvents = await afishaDownload(dates, { limitEvents: appConfig.LIMIT_EVENTS_PER_PARSE, snapshotDirectory: appConfig.JSON_SNAPSHOT_DIR })

        const newEvents: ParsedEventToSave[] = filterOnlyBotSpecificEvents(allEvents)
        debug(`Diffing ${newEvents.length} interesting events excel (${allEvents.length} total)`)

        const diff = await db.task(async (t: ITask<unknown>) => {
            // const newEventsWithDates = await enrichEventsWithPastDates(newEvents, new Date(), t)

            return await db.repoSync.prepareDiffForSync(newEvents, t)
        })

        const diffReport = await prepareDiffReport(diff);

        const excel = await authToExcel(appConfig.GOOGLE_AUTH_FILE)
        await saveDiffToExcel(excel, diffReport, dates)
        await db.$pool.end()
        logger.info(`Diff report ready. Changedids=${diff.updated.map(u => u.primaryData.id).join(',')} Total=${[...diff.recovered, ...diff.updated, ...diff.inserted].length} changed`)
    } catch (e) {
        logger.error(e)
        process.exit(1)
    }
})()