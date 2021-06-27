import { DateInterval } from '../interfaces/app-interfaces'
import { formatISO } from 'date-fns'

export function mapToPgInterval(interval: DateInterval): string {
    return `[${[interval.start, interval.end].map(i => formatISO(i)).join(',')}]`
}

/**
 * UPPER(${entrance}) = LOWER(${entrance}) used fo single events like [10:00; 10:00)
 * @param s
 * @param entrance
 */
export function rangeHalfOpenIntersect(s: string, entrance: string): string {
    return `(${s} && ${entrance}) AND UPPER(${s}) != LOWER(${entrance}) AND
       (
            UPPER(${entrance}) = LOWER(${entrance}) OR LOWER(${s}) != UPPER(${entrance})
        )`
}

