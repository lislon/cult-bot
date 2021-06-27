import { addHours } from 'date-fns/fp'
import { ContextMessageUpdate, DateInterval } from '../../interfaces/app-interfaces'
import { startOfDay } from 'date-fns'
import { filterByRange } from '@culthub/timetable'
import { saveSession } from '../../middleware-utils'
import { parseSlot } from './customize-common'

export function mapUserInputToTimeIntervals(times: string[], weekendInterval: DateInterval): DateInterval[] {
    const hours = (times)
        .map(t => parseSlot(t))
        .map(({date, startTime, endTime}) => [
            date,
            +startTime.replace(/:00/, ''),
            +endTime.replace(/:00/, '')
        ])
        .flatMap(([date, from, to]) => {
            if (from < to) {
                return [[date, from, to]]
            } else {
                return [[date, 0, to], [date, from, 24]]
            }
        })
        .map(([date, from, to]: [Date, number, number]) => {
            return [addHours(from)(startOfDay(date)), addHours(to)(startOfDay(date))]
        })

    const range = filterByRange(hours, weekendInterval, 'in')
    const map = range.map(fromto => {
        if (Array.isArray(fromto)) {
            return {
                start: fromto[0],
                end: fromto[1]
            }
        } else {
            throw Error('wtf')
        }
    })
    return map
}

export async function resetSessionIfProblem(ctx: ContextMessageUpdate, callback: () => Promise<void>) {
    try {
        await callback()
    } catch (e) {
        ctx.session.customize = undefined
        await saveSession(ctx)
        throw e
    }
}