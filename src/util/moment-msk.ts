import { isBefore, parse } from 'date-fns'

export const mskMoment = (arg: string) => parse(arg, 'yyyy-MM-dd HH:mm', new Date())

export function isAfterOrEquals(holidayDate: Date, dateToCompare: Date) {
    return !isBefore(holidayDate, dateToCompare)
}