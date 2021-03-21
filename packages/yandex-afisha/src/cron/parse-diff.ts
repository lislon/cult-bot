import { ParsedEventToSave } from '../database/parsed-event'
import { ITask } from 'pg-promise'
import { saveDiffToExcel } from '../lib/export-to-excel'
import { authToExcel } from '@culthub/google-docs'
import { appConfig } from '../app-config'
import { filterOnlyBotSpecificEvents } from '../lib/filter-logic'
import { db } from '../database/db'
import debugNamespace from 'debug'
import { afishaDownload, toBotCategory } from '../lib/afisha-download'
import { logger } from '../logger'
import { format } from 'date-fns'
import { prepareDiffReport } from '../lib/diff-logic'
import { CliCronArgs, parseCronArgs, parseDates } from './parse-common'
import { apiFindMatching } from '../api-client/bot-api-client'
import { UniversalSyncDiff } from '@culthub/universal-db-sync'
import { DeletedColumns } from '../interfaces'
import { RequestError } from 'got'
import { FindMatchingEventResponse } from '@culthub/interfaces'

const debug = debugNamespace('yandex-parser:cron');

const argv: CliCronArgs = parseCronArgs();

async function tryFindMatchingIds(diff: UniversalSyncDiff<ParsedEventToSave, DeletedColumns>): Promise<FindMatchingEventResponse> {
    try {
        const botExtIds = await apiFindMatching({
            events: [
                ...[...diff.updated, ...diff.notChanged, ...diff.inserted, ...diff.recovered].map(e => ({
                    id: e.primaryData.extId,
                    category: toBotCategory(e.primaryData.category),
                    title: e.primaryData.title
                })),
                ...[...diff.deleted].map(e => ({
                    id: e.primaryData.extId,
                    category: toBotCategory(e.old.category),
                    title: e.old.title
                }))
            ]
        })
        return botExtIds
    } catch (e) {
        if (e instanceof RequestError && e.code === 'ECONNREFUSED') {
            logger.warn('Skipping binding BotIds:' + e)
        } else {
            logger.error(e)
        }
        return {
            events: []
        }
    }
}

(async function () {
    try {
        const dates = parseDates(argv)
        logger.info(`parse-diff: ${dates.map(d => format(d, 'MMMM dd')).join(', ')}...`)

        const allEvents = await afishaDownload(dates, {
            limitEvents: appConfig.LIMIT_EVENTS_PER_PARSE,
            snapshotDirectory: appConfig.JSON_SNAPSHOT_DIR
        })

        const newEvents: ParsedEventToSave[] = filterOnlyBotSpecificEvents(allEvents)
        debug(`Diffing ${newEvents.length} interesting events excel (${allEvents.length} total)`)

        const diff = await db.task(async (t: ITask<unknown>) => {
            // const newEventsWithDates = await enrichEventsWithPastDates(newEvents, new Date(), t)

            return await db.repoSync.prepareDiffForSync(newEvents, t)
        })


        const botExtIds = await tryFindMatchingIds(diff)

        const diffReport = await prepareDiffReport(diff, botExtIds)

        const excel = await authToExcel(appConfig.GOOGLE_AUTH_FILE)
        await saveDiffToExcel(excel, diffReport, dates)
        await db.$pool.end()
        logger.info(`Diff report ready https://docs.google.com/spreadsheets/d/${appConfig.GOOGLE_DOCS_ID}/edit#gid=2134978656 . Changed_ids=${diff.updated.map(u => u.primaryData.id).join(',')} Total=${[...diff.recovered, ...diff.updated, ...diff.inserted].length} changed`)
    } catch (e) {
        logger.error(e)
        process.exit(1)
    }
})()