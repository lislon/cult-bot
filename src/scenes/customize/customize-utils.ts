import { addDays, addHours } from 'date-fns/fp'
import { ContextMessageUpdate, MyInterval } from '../../interfaces/app-interfaces'
import { startOfISOWeek } from 'date-fns'
import { filterByRange } from '../../lib/timetable/intervals'
import { saveSession } from '../../middleware-utils'

export function mapUserInputToTimeIntervals(times: string[], weekendInterval: MyInterval): MyInterval[] {
    const hours = (times)
        .map(t => t.split(/[-.]/))
        .map(([day, from, to]) => [
            day,
            +from.replace(/:00/, ''),
            +to.replace(/:00/, '')
        ])
        .flatMap(([day, from, to]) => {
            if (from < to) {
                return [[day, from, to]]
            } else {
                return [[day, 0, to], [day, from, 24]]
            }
        })
        .map(([day, from, to]: [string, number, number]) => {
            const baseDay = addDays(day === 'saturday' ? 5 : 6)(startOfISOWeek(weekendInterval.start))
            return [addHours(from)(baseDay), addHours(to)(baseDay)]
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