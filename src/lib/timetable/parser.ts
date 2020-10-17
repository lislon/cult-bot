import * as P from 'parsimmon'
import { Result, Success } from 'parsimmon'
import { DateExact, DateRange, EventTimetable, mapInterval, WeekTime } from './intervals'
import { cleanText } from './timetable-utils'
import { addYears, format, isValid, parseISO, setYear } from 'date-fns'
import cloneDeep from 'lodash/cloneDeep'


type FromToPair = { from: string, to: string }
export const YEAR_UNKNOWN_VALUE = 9999

export type RawParseResultV = {
    dateRange?: DateRange
    weekTimes?: WeekTime[]
    dateRangesTimetable?: {
        dateRange: DateRange
        weekTimes: WeekTime[]
    }
    exactDate?: DateExact
    anytime?: true
}

interface RawParseResult {
    [Symbol.iterator](): Iterator<RawParseResultV>;
}

const timetableLang = P.createLanguage({
    DayOfMonth: () => P.regexp(/[0-9]{1,2}/).map(s => s.padStart(2, '0')).desc('День месяца'),
    Year: () => P.regexp(/20[0-9]{2}/)
        .fallback(YEAR_UNKNOWN_VALUE)
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
        .alt(P.string('в любое время'))
        .desc('Фраза "в любое время"'),
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
                const before = [...Array(+to).keys()].map(x => 1 + x)
                const after = [...Array(+7 - +from + 1).keys()].map(x => +x + +from)
                return P.succeed([...before, ...after])
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
            return {exactDate: {dateRange, times}}
        }),
    WeekDateTimetable: (r) => P.seq(r.WeekDays, r[':'], r._, r.TimesOrTimeRanges)
        .map(([weekdays, , , times]) => {
            return {weekdays, times}
        }),
    WeekDatesTimetable: (r) => P.sepBy1(r.WeekDateTimetable, P.seq(r._, r[','], r._))
        .map((weekTimes) => {
            return {weekTimes};
        }),
    DateRangeTimetable: (r) => P.seq(r.DateRange, r[':'], P.seq(r._, r.NewLine.atMost(1), r._), r.WeekDatesTimetable)
        .map(([dateRange, , , {weekTimes}]) => {
            return {dateRangesTimetable: {dateRange, weekTimes}}
        }),
    DateRangeTimes: (r) => P.seq(r.DateRange, r[':'], r._, r.TimesOrTimeRanges)
        .map(([dateRange, , , times]) => {
            return {dateRange, times}
        }),
    DateRangeTimetablesOrExactDatesOrWeekDateTimetable: (r) =>
        P.alt(r.DateRangeTimetable,
            r.ExactDateTimes,
            r.DateRangeTimes,
            r.WeekDatesTimetable),
    Everything: (r) => P.alt(
        r.AnyTime.result([{anytime: true}]),
        P.sepBy1(r.DateRangeTimetablesOrExactDatesOrWeekDateTimetable, r.Divider)),
    Divider: (r) => P.seq(r._, P.alt(r[';'], r.NewLine), r._),
    NewLine: (r) => P.regex(/[\n\r]+/).desc('новая строка'),
    [';']: () => P.string(';').desc('точка с запятой'),
    [',']: () => P.string(',').desc('запятая'),
    ['-']: () => P.string('-').desc('диапазон через дефис'),
    [':']: () => P.string(':').desc('двоеточие'),
    From: () => P.string('с').desc('диапазон через дефис "с xxx до xxx"'),
    To: () => P.string('до').desc('фраза "до"'),
    ToDate: () => P.alt(P.string('до'), P.string('по')),
    _: () => P.regex(/[^\S\r\n]*/).desc('пробелы'),
})


function arrayfie(): (result: any[]) => any[] {
    return (d) => Array.isArray(d) ? d : [d];
}


function validateAndFixDate(p: string, errors: string[], now: Date): string {
    const date = parseISO(p)
    if (!isValid(date)) {
        errors.push(`Дата "${p}" не может существовать`)
        return p;
    }
    if (date.getFullYear() === YEAR_UNKNOWN_VALUE) {
        const newDate = setYear(date, now.getFullYear())
        return format((newDate < now ? addYears(newDate, 1) : newDate), 'yyyy-MM-dd')
    }
    return p;
}

function fillUnkownYearsAndValidate(parse: Success<RawParseResult>, dateValidation: string[], now: Date): Success<RawParseResult> {
    const fixed = cloneDeep(parse)

    const validationAndFixation = (d: string) => validateAndFixDate(d, dateValidation, now)

    for (const p of fixed.value) {
        if (p.dateRange !== undefined) {
            p.dateRange = mapInterval(p.dateRange, validationAndFixation) as any
        } else if (p.dateRangesTimetable !== undefined) {
            p.dateRangesTimetable.dateRange = mapInterval(p.dateRangesTimetable.dateRange, validationAndFixation) as any
        } else if (p.exactDate) {
            p.exactDate.dateRange = mapInterval(p.exactDate.dateRange, validationAndFixation) as any
        }
    }
    return fixed;
}

export type TimetableParseResult = {
    status: true
    value: EventTimetable
} | {
    status: false
    errors: string[]
}


export function parseTimetable(text: string, now: Date): TimetableParseResult {
    const input = cleanText(text)
    let parseRes: Result<RawParseResult> = timetableLang.Everything.parse(input);
    // const fixYear = (date: string) => parse(date, 'yyyy-MM-dd')

    if (parseRes.status === true) {

        const dateValidation: string[] = []
        parseRes = fillUnkownYearsAndValidate(parseRes, dateValidation, now)
        if (dateValidation.length > 0) {
            return {status: false, errors: dateValidation}
        }

        const result: EventTimetable = {
            dateRangesTimetable: [],
            datesExact: [],
            weekTimes: [],
            anytime: false
        }
        for (const p of parseRes.value) {
            if (p.dateRange !== undefined) {
                result.dateRangesTimetable.push(p)
            } else if (p.weekTimes !== undefined) {
                result.weekTimes = [...result.weekTimes, ...p.weekTimes]
            } else if (p.dateRangesTimetable !== undefined) {
                result.dateRangesTimetable.push({
                    dateRange: p.dateRangesTimetable.dateRange,
                    weekTimes: p.dateRangesTimetable.weekTimes,
                })
            } else if (p.exactDate) {
                result.datesExact.push(p.exactDate)
            } else if (p.anytime) {
                result.anytime = true;
            }
        }
        return {status: parseRes.status, value: result}
    } else {
        const errors: string[] = []
        if (input.length === 0) {
            errors.push(`Пустая строка`)
        } else if (parseRes.index.offset === input.length) {
            errors.push(`После строки "${input}" я ожидала получить, например, следующее:`)
            parseRes.expected.forEach(e => errors.push(` - ${e}`))
            errors.push(`Но в строке больше ничего нет`)
        } else if (parseRes.index.offset === 0) {
            errors.push(`Не смогла понять что это: "${input}". Я ожидала одно из:`)
            parseRes.expected.forEach(e => errors.push(` - ${e}`))
        } else {
            errors.push(`После строки "${input.substr(0, parseRes.index.offset)}" я ожидала:`)
            parseRes.expected.forEach(e => errors.push(` - ${e}`))
            errors.push(`И текст "${input.substr(parseRes.index.offset)}" не подходит к вышеперечисленному`)
        }
        return {status: parseRes.status, errors: errors}
    }
}
