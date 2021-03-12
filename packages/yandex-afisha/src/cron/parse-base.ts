import { ParsedEventToSave } from '../database/parsed-event'
import { ITask } from 'pg-promise'
import { saveCurrentToExcel } from '../lib/export-to-excel'
import { authToExcel } from '@culthub/google-docs'
import { appConfig } from '../app-config'
import { filterOnlyBotSpecificEvents } from '../lib/filter-logic'
import { db } from '../database/db'
import { getNextWeekendDates } from '../lib/cron-common'
import debugNamespace from 'debug'
import { ruFormat } from '../lib/ruFormat'
import { afishaDownload } from '../lib/afisha-download'

const debug = debugNamespace('yandex-parser');


(async function () {
    try {
        const dates = getNextWeekendDates(new Date())
        debug(`Start parsing dates ${dates.map(d => ruFormat(d, 'MMMM dd')).join(', ')}...`)
        const allEvents = await afishaDownload(dates, { limitEvents: appConfig.LIMIT_EVENTS_PER_PARSE, snapshotDirectory: appConfig.JSON_SNAPSHOT_DIR })
        const newEvents: ParsedEventToSave[] = filterOnlyBotSpecificEvents(allEvents)

        debug(`Saving ${newEvents.length} interesting events to database (${allEvents.length} total)`)
        const diff = await db.task(async (t: ITask<unknown>) => {
            // const newEventsWithDates = await enrichEventsWithPastDates(newEvents, new Date(), t)

            const diff = await db.repoSync.prepareDiffForSync(newEvents, t)
            return await db.repoSync.syncDiff(diff, t)
        })

        debug(`Updating excel...`)
        const parsedEventToRecovers = ([...diff.recovered, ...diff.updated, ...diff.inserted, ...diff.notChanged])
        const excel = await authToExcel(appConfig.GOOGLE_AUTH_FILE)
        await saveCurrentToExcel(excel, parsedEventToRecovers.map(e => e.primaryData), dates)
        await db.$pool.end()
        debug(`Done`)
    } catch (e) {
        console.log(e)
        process.exit(1)
    }
})()