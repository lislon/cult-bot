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
    return `(${s} && ${entrance}) AND UPPER(${s}) != LOWER(${entrance}) AND
       (
            UPPER(${entrance}) = LOWER(${entrance}) OR LOWER(${s}) != UPPER(${entrance})
        )`
}

export function fieldStr(column: string) {
    return {
        name: column,
        skip: (c: { value: any }) => c.value === null || c.value === undefined
    };
}

// while parsing the type correctly:
export function fieldInt(column: string) {
    return {
        name: column,
        skip: (c: { value: any }) => c.value === null || c.value === undefined,
        init: ({value, exists}: { value: any, exists: boolean }) => exists ? +value : undefined
    };
}

export function fieldTextArray(column: string) {
    return {
        name: column,
        cast: 'text[]',
        skip: (c: { value: any }) => c.value === null || c.value === undefined
    };
}

export function fieldInt8Array(column: string) {
    return {
        name: column,
        cast: 'int8[]',
        skip: (c: { value: any }) => c.value === null || c.value === undefined
    };
}

export function fieldTimestamptzNullable(column: string) {
    return {
        name: column,
        cast: 'timestamptz',
        skip: (c: { value: any }) => c.value === undefined
    };
}