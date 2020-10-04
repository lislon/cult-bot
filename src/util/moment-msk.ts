import moment from 'moment'
import 'moment-timezone/index'

moment.updateLocale('en', {
    week : {
        dow: 1, // First day of week is Monday
        doy: 4  // First week of year must contain 4 January (7 + 1 - 4)
    }
});

export const mskMoment = (...args: string[]) => moment(...args).tz('Europe/Moscow', true).locale('en')