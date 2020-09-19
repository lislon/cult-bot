import moment from 'moment'
import 'moment-timezone/index'


export const mskMoment = (...args: string[]) => moment(...args).tz('Europe/Moscow', true).locale('en')