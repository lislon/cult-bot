import { addHours } from 'date-fns/fp'
import { ContextMessageUpdate, MyInterval } from '../../interfaces/app-interfaces'
import { parse, startOfDay } from 'date-fns'
import { filterByRange } from '../../lib/timetable/intervals'
import { saveSession } from '../../middleware-utils'

export function mapUserInputToTimeIntervals(times: string[], weekendInterval: MyInterval): MyInterval[] {
    const hours = (times)
        .map(t => t.split(/\.|-(?=\d\d:\d\d$)/))
        .map(([dateStr, from, to]) => [
            parse(dateStr, 'yyyy-MM-dd', new Date()),
            +from.replace(/:00/, ''),
            +to.replace(/:00/, '')
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