import { addDays, addHours, startOfDay } from 'date-fns/fp'
import { MyInterval } from '../../interfaces/app-interfaces'

export function mapUserInputToTimeIntervals(times: string[], weekendInterval: Interval): MyInterval[] {
    return (times)
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
                const baseDay = startOfDay(addDays(day === 'saturday' ? 0 : 1)(weekendInterval.start))
                return {
                    start: addHours(from)(baseDay),
                    end: addHours(to)(baseDay)
                }
            });
}
