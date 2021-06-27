import { format, parseISO } from 'date-fns'
import yargs from 'yargs'
import { getNextWeekendDates } from '../lib/cron-common'
import { UniversalSyncDiff } from '@culthub/universal-db-sync'
import { ParsedEventToSave } from '../database/parsed-event'
import { DeletedColumns } from '../interfaces'
import { FindMatchingEventResponse } from '@culthub/interfaces'
import { apiFindMatching } from '../api-client/bot-api-client'
import { toBotCategory } from '../lib/afisha-download'
import { RequestError } from 'got'
import { logger } from '../logger'

export interface CliCronArgs {
    now: string
    dates: (string | number)[]
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function parseCronArgs(): CliCronArgs {
    return yargs(process.argv.slice(2))
        .option('now', {
            alias: 'n',
            description: 'Will override now to find next holidays (yyyy-MM-dd)',
            type: 'string',
            default: format(new Date(), 'yyyy-MM-dd')
        })
        .option('dates', {
            type: 'array',
            default: []
        })
        .help()
        .alias('help', 'h')
        .argv
}

export function parseDates(argv: CliCronArgs): Date[] {
    const dates = argv.dates.length > 0 ? argv.dates.map(q => parseISO(q + '')) : getNextWeekendDates(parseISO(argv.now))
    return dates
}

export async function tryFindMatchingIds(diff: UniversalSyncDiff<ParsedEventToSave, DeletedColumns>): Promise<FindMatchingEventResponse> {
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