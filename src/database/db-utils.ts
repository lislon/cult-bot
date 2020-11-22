import { MyInterval } from '../interfaces/app-interfaces'
import { formatISO } from 'date-fns'

export function mapToPgInterval(interval: MyInterval) {
    return `[${[interval.start, interval.end].map(i => formatISO(i)).join(',')}]`
}

/**
 * UPPER(${entrance}) = LOWER(${entrance}) used fo single events like [10:00; 10:00)
 * @param s
 * @param entrance
 */
export function rangeHalfOpenIntersect(s: string, entrance: string) {
    return `${s} && ${entrance} AND
               (
                    UPPER(${entrance}) = LOWER(${entrance})
                        OR
                    (UPPER(${s}) != LOWER(${entrance}) AND LOWER(${s}) != UPPER(${entrance}))
                )`
}