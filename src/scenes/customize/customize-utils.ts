import { Moment } from 'moment'

export function mapUserInputToTimeIntervals(times: string[], [sat, ]: Moment[]): Moment[][] {
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
            const baseDay = sat.clone().add(day === 'saturday' ? 0 : 1, 'day').startOf('day')
            return [
                baseDay.clone().add(from, 'hour'),
                baseDay.clone().add(to, 'hour'),
            ]
        });
}
