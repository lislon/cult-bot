import { format, Locale } from 'date-fns'
import { ru } from 'date-fns/locale'

const ruDateFormat: {
    locale?: Locale
    weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6
    firstWeekContainsDate?: number
    useAdditionalWeekYearTokens?: boolean
    useAdditionalDayOfYearTokens?: boolean
} = {
    locale: ru,
    weekStartsOn: 1
}

export function ruFormat(date: Date | number, pattern: string): string {
    return format(date, pattern, ruDateFormat)
}