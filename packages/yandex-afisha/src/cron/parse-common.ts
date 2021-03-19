import { format, parseISO } from 'date-fns'
import yargs from 'yargs'
import { getNextWeekendDates } from '../lib/cron-common'

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
        .argv;
}

export function parseDates(argv: CliCronArgs): Date[] {
    const dates = argv.dates.length > 0 ? argv.dates.map(q => parseISO(q + '')) : getNextWeekendDates(parseISO(argv.now))
    return dates;
}