import * as P from 'parsimmon'
import { Result } from 'parsimmon'
import { EventDate } from './intervals';
import { cleanText } from './timetable-utils'
import moment = require('moment')
import { mskMoment } from '../../util/moment-msk'


type FromToPair = { from: string, to: string }
const Lang = P.createLanguage({
    DayOfMonth: () => P.regexp(/[0-9]{1,2}/).map(s => s.padStart(2, '0')).desc('День месяца'),
    Year: () => P.regexp(/20[0-9]{2}/)
        .fallback(mskMoment().year())
        .desc('Год')
    ,
    Month: () => P.regexp(/[а-я]+/)
        .desc('Название месяца')
        .chain(s => {
            const monthNames = [
                'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
            ];
            const n = monthNames.indexOf(s) + 1;
            if (n > 0) {
                return P.succeed((n + '').padStart(2, '0'));
            } else {
                return P.fail(`${s} is not a valid month`);
            }
        }),
    WeekDaySingle: () => P.regexp(/[а-я]+/)
        .desc('День недели')
        .chain(s => {
            const weekdaysFlavors = [
                ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'],
                ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'],
                ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суб', 'воскр'],
                ['понедельника', 'вторника', 'среды', 'четверга', 'пятницы', 'субботы', 'воскресенья'],
            ];
            let n = 0
            for (const weekday of weekdaysFlavors) {
                n = weekday.indexOf(s) + 1;
                if (n > 0) {
                    break;
                }
            }

            if (n > 0) {
                return P.succeed(n);
            } else {
                return P.fail(`день недели`);
            }
        }),
    AnyTime: () => P
        .alt(P.string('в любое время'), P.string('онлайн'))
        .desc('Фраза "в любое время" или "онлайн"'),
    Date: (r) => P.seq(r.DayOfMonth, r._, r.Month, r._, r.Year)
        .map(([dayOfMonth, , month, , year]) => {
            return `${year}-${month}-${dayOfMonth}`;
        }),
    ['hh']: () => P.regexp(/^\d{1,2}/),
    ['hh:mm']: (r) => P.seq(r['hh'], P.regexp(/[:.]\d{2}/).fallback(':00'))
        .tieWith('')
        .map(d => d.replace('.', ':').padStart(5, '0'))
        .desc('время (hh:mm)')
    ,
    ['hh:mm-hh:mm']: (r) => P.alt(
        P.seqObj<FromToPair>(['from', r['hh:mm']], r._, r['-'], r._, ['to', r['hh:mm']]),
        P.seqObj<FromToPair>(r.From, r._, ['from', r['hh:mm']], r._, r.To, r._, ['to', r['hh:mm']]),
        r.AnyTime.result({from: '00:00', to: '24:00'})
    )
        .map(({from, to}) => {
            return [from, to];
        })
        .desc('интервал времени (hh:mm - hh:mm)'),
    TimeOrTimeRange: (r) => r['hh:mm-hh:mm'].or(r['hh:mm']),
    TimesOrTimeRanges: (r) => P.sepBy1(r.TimeOrTimeRange, P.seq(r._, r[','], r._)),
    DateRange: (r) => P.alt(
        P.seqObj<FromToPair>(r.From, r._, ['from', r.Date], r._, r.ToDate, r._, ['to', r.Date]),
        P.seqObj<FromToPair>(['from', r.Date], r._, r['-'], r._, ['to', r.Date]))
        .map(({from, to}) => {
            return [from, to];
        }).desc('Интервал дат'),
    DateOrDateRange: (r) => r.Date.or(r.DateRange).map(arrayfie()),
    WeekDayRange: (r) => P.seq(r.WeekDaySingle, r._, r['-'], r._, r.WeekDaySingle)
        .chain(([from, , , , to]) => {
            if (+to - +from + 1 <= 0) {
                return P.fail(`День недели перепутан`);
            } else {
                return P.succeed([...Array(+to - +from + 1).keys()].map(x => +x + +from))
            }
        }),
    WeekDayEveryDay: () => P.string('ежедневно').map(() => [1, 2, 3, 4, 5, 6, 7]),
    WeekDay: (r) => r.WeekDayRange.or(r.WeekDaySingle.map(r => [r])),
    WeekDays: (r) => P.alt(
        P.sepBy1(r.WeekDay, P.seq(r._, r[','], r._))
            .map(results => results.flatMap(z => z)),
        r.WeekDayEveryDay
    ),
    ExactDateTimes: (r) => P.seq(r.DateOrDateRange, r[':'], r._, r.TimesOrTimeRanges)
        .map(([dateRange, , , times]) => {
            return {dateRange, times}
        }),
    ExactDatesTimes: (r) => P.sepBy1(r.ExactDateTimes, P.seq(r._, r[';'], r._))
        .map((exactDates) => {
            return {exactDates};
        }),
    WeekDateTimetable: (r) => P.seq(r.WeekDays, r[':'], r._, r.TimesOrTimeRanges)
        .map(([weekdays, , , times]) => {
            return {weekdays, times}
        }),
    WeekDatesTimetable: (r) => P.sepBy1(r.WeekDateTimetable, P.seq(r._, r[','], r._))
        .map((weekTimes) => {
            return {weekTimes};
        }),
    DateRangeTimetable: (r) => P.seq(r.DateRange, r[':'], r._, r.WeekDatesTimetable)
        .map(([dateRange, , , weekDates]) => {
            return {dateRange, weekDates}
        }),
    DateRangeTimes: (r) => P.seq(r.DateRange, r[':'], r._, r.TimesOrTimeRanges)
        .map(([dateRange, , , times]) => {
            return {dateRange, times}
        }),
    DateRangeTimetables: (r) => P.sepBy1(r.DateRangeTimetable, P.seq(r._, r.Divider, r._))
        .map(([dateRangesTimetable]) => {
            return {dateRangesTimetable}
        }),
    DateRangeTimetablesOrExactDatesOrWeekDateTimetable: (r) =>
        r.DateRangeTimetables
            .or(r.ExactDatesTimes)
            .or(r.DateRangeTimes)
            .or(r.WeekDatesTimetable),
    Everything: (r) => P.alt(
        r.AnyTime.result([{anytime: true}]),
        P.sepBy1(r.DateRangeTimetablesOrExactDatesOrWeekDateTimetable, P.seq(r._, r.Divider, r._))),
    Divider: (r) => P.alt(r[';'], P.newline),
    [';']: () => P.string(';').desc('точка с запятой'),
    [',']: () => P.string(',').desc('запятая'),
    ['-']: () => P.string('-').desc('диапазон через дефис'),
    [':']: () => P.string(':').desc('двоеточие'),
    From: () => P.string('с').desc('диапазон через дефис "с xxx до xxx"'),
    To: () => P.string('до').desc('фраза "до"'),
    ToDate: () => P.alt(P.string('до'), P.string('по')),
    _: () => P.optWhitespace,
});


function arrayfie(): (result: any[]) => any[] {
    return (d) => Array.isArray(d) ? d : [d];
}

export function parseTimetable(text: string) {
    const input = cleanText(text)
    const parse: Result<any> = Lang.Everything.parse(input);
    if (parse.status === true) {

        const result: EventDate = {
            dateRangesTimetable: [],
            datesExact: [],
            weekTimes: [],
            anytime: false
        }
        for (const p of parse.value) {
            if (p.dateRange !== undefined) {
                result.dateRangesTimetable.push(p)
            } else if (p.weekTimes !== undefined) {
                result.weekTimes.push.apply(result.weekTimes, p.weekTimes)
            } else if (p.dateRangesTimetable !== undefined) {
                result.dateRangesTimetable.push({
                    dateRange: p.dateRangesTimetable.dateRange,
                    weekTimes: p.dateRangesTimetable.weekDates && p.dateRangesTimetable.weekDates.weekTimes,
                })
            } else if (p.exactDates) {
                result.datesExact.push.apply(result.datesExact, p.exactDates)
            } else if (p.anytime) {
                result.anytime = true;
            }
        }
        return {status: parse.status, value: result}
    } else {
        const text = []
        if (input.length === 0) {
            text.push(`Пустая строка`)
        } else if (parse.index.offset === input.length) {
            text.push(`После строки "${input}" я ожидала получить, например, следующее:`)
            parse.expected.forEach(e => text.push(` - ${e}`))
            text.push(`Но в строке больше ничего нет`)
        } else if (parse.index.offset === 0) {
            text.push(`Не смогла понять что это: "${input}". Я ожидала одно из:`)
            parse.expected.forEach(e => text.push(` - ${e}`))
        } else {
            text.push(`После строки "${input.substr(0, parse.index.offset)}" я ожидала:`)
            parse.expected.forEach(e => text.push(` - ${e}`))
            text.push(`И текст "${input.substr(parse.index.offset)}" не подходит к вышеперечисленному`)
        }
        return {status: parse.status, error: text}
    }
}
