import { Moment } from 'moment'

export function mapToPgInterval(adjustedIntervals: Moment[]) {
    return `[${adjustedIntervals.map(i => i.toISOString(true)).join(',')}]`
}