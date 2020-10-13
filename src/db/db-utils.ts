import { MyInterval } from '../interfaces/app-interfaces'
import { formatISO } from 'date-fns'

export function mapToPgInterval(interval: MyInterval) {
    return `[${[interval.start, interval.end].map(i => formatISO(i)).join(',')}]`
}