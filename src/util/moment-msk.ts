import { parse } from 'date-fns'

export const mskMoment = (arg: string) => parse(arg, 'yyyy-MM-dd HH:mm', new Date())