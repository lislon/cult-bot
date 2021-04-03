import * as P from 'parsimmon'
import { Result, Success } from 'parsimmon'
import { DayTime, mapInterval} from './intervals'
import { addYears, format, isValid, parseISO, setYear, subMonths } from 'date-fns'
import cloneDeep from 'lodash/cloneDeep'
import { DateExact, DateOrDateRange, DateRange, EventTimetable, isDateRange, WeekTime } from './interfaces'


type FromToPair = { from: string, to: string }
export const YEAR_UNKNOWN_VALUE = 9999

export type RawParseResultV = {
    dateRange?: DateRange
    times?: DayTime[]
    weekTimes?: WeekTime[]
    dateRangesTimetable?: {
        dateRange: DateRange
        weekTimes: WeekTime[]
    }
    exactDate?: DateExact
    anytime?: true
    anytimeComment?: string
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
    Month: () => P.regexp(/[а-я]+/i)
        .desc('Название месяца')
        .chain(s => {
            const monthNames = [
                'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
            ];
            const n = monthNames.indexOf(onlyRussianLetters(s.toLowerCase())) + 1;
            if (n > 0) {
                return P.succeed((n + '').padStart(2, '0'));
            } else {
                return P.fail(`${s} is not a valid month`);
            }
        }),
    WeekDaySingle: () => P.regexp(/[а-яА-ЯcC]+/)
        .desc('День недели')
        .chain(s => {
            const weekdaysFlavors = [
                ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'],
                ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'],
                ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суб', 'воскр'],
                ['понедельника', 'вторника', 'среды', 'четверга', 'пятницы', 'субботы', 'воскресенья'],
            ];
            let n = 0
            const lowS = onlyRussianLetters(s.toLowerCase())
            for (const weekday of weekdaysFlavors) {
                n = weekday.indexOf(lowS) + 1;
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
        .alt(stringIgnoreCase('в любое время'))
        .desc('Фраза "в любое время"'),
    Date: (r) => P.seq(r.DayOfMonth, r.__, r.Month, r._, r.Year)
        .map(([dayOfMonth, , month, , year]) => {
            return `${year}-${month}-${dayOfMonth}`
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
        P.alt(
            P.seqObj<FromToPair>(r.From, r._, ['from', r.Date], r._, r.ToDate, r._, ['to', r.Date]),
            P.seqObj<FromToPair>(['from', r.Date], r._, r['-'], r._, ['to', r.Date]))
            .map(({from, to}) => {
                return [from, to];
            }),
        P.seq(r.DayOfMonth, r._, r['-'], r._, r.DayOfMonth, r.__, r.Month, r._, r.Year)
            .map(([dayOfMonthFrom, , , , dayOfMonthFromTo, , month, , year]) => {
                return [`${year}-${month}-${dayOfMonthFrom}`, `${year}-${month}-${dayOfMonthFromTo}`]
            }),
    ).desc('Интервал дат'),
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
    WeekDayEveryDay: () => stringIgnoreCase('ежедневно').map(() => [1, 2, 3, 4, 5, 6, 7]),
    WeekDay: (r) => r.WeekDayRange.or(r.WeekDaySingle.map(r => [r])),
    WeekDays: (r) => P.alt(
        P.sepBy1(r.WeekDay, P.seq(r._, r[','], r._))
            .map(results => results.flatMap(z => z)),
        r.WeekDayEveryDay
    ),
    MaybeComment: (r) => P.seq(r._, r.TextInBraces)
        .map(([,comment]) => ({ comment }))
        .fallback({}),
    ExactDateTimes: (r) => P.seq(r.Date, r[':'], r._, r.TimesOrTimeRanges, r.MaybeComment)
        .map(([date, , , times, comment]) => {
            return { exactDate: {date, times, ...comment} }
        }),
    WeekDateTimetable: (r) => P.seq(r.WeekDays, r[':'], r._, r.TimesOrTimeRanges, r.MaybeComment)
        .map(([weekdays, , , times, comment]): WeekTime => {
            return {weekdays, times, ...comment}
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
        P.seq(r.AnyTime, r.MaybeComment).map(([, anytimeComment]) => ([{ anytime: true, anytimeComment: (anytimeComment ? anytimeComment.comment : undefined) }])),
        P.sepBy1(r.DateRangeTimetablesOrExactDatesOrWeekDateTimetable, r.Divider)),
    Divider: (r) => P.seq(r._, P.alt(r[';'], r.NewLine), r._),
    NewLine: () => P.regex(/[\n\r]+/).desc('новая строка'),
    [';']: () => P.string(';').desc('точка с запятой'),
    [',']: () => P.string(',').desc('запятая'),
    ['-']: () => P.oneOf('-—‑–－﹘').desc('диапазон через дефис'),
    [':']: () => P.string(':').desc('двоеточие'),
    ['(']: () => P.string('(').desc('('),
    [')']: () => P.string(')').desc(')'),
    From: () => stringIgnoreCase('с').desc('диапазон через дефис "с xxx до xxx"'),
    To: () => stringIgnoreCase('до').desc('фраза "до"'),
    ToDate: () => P.alt(stringIgnoreCase('до'), stringIgnoreCase('по')),
    TextInBraces: () => P.regex(/[(]([^)]+)[)]/, 1).desc('текст в скобках'),
    _: () => P.regex(/[^\S\r\n]*/).desc('пробелы'),
    __: () => P.regex(/[^\S\r\n]+/).desc('пробелы'),
})

function stringIgnoreCase(str: string): P.Parser<string> {
    const expected = "'" + str + "'";
    return P.Parser(function(input, i) {
        const j = i + str.length;
        const head = input.slice(i, j);
        if (head.toLowerCase() === str.toLowerCase()) {
            return P.makeSuccess(j, head);
        } else {
            return P.makeFailure(i, expected);
        }
    })
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

function fillUnknownYearsAndValidate(parse: Success<RawParseResult>, dateValidation: string[], now: Date): Success<RawParseResult> {
    const fixed: Success<RawParseResult> = cloneDeep(parse)

    const validationAndFixation: (d: string) => string = (d: string) => validateAndFixDate(d, dateValidation, now)
    const validateDateRangeOrder = (d: DateOrDateRange) => {
        if (isDateRange(d) && d[0] > d[1]) {
            dateValidation.push(`Дата '${d[0]}' должна быть меньше, чем '${d[1]}'`)
        }
    }

    for (const p of fixed.value) {
        if (p.dateRange !== undefined) {
            p.dateRange = mapInterval(p.dateRange, validationAndFixation)
            validateDateRangeOrder(p.dateRange)
        } else if (p.dateRangesTimetable !== undefined) {
            p.dateRangesTimetable.dateRange = mapInterval(p.dateRangesTimetable.dateRange, validationAndFixation)
            validateDateRangeOrder(p.dateRangesTimetable.dateRange)
        } else if (p.exactDate) {
            p.exactDate.date = validationAndFixation(p.exactDate.date)
            validateDateRangeOrder(p.exactDate.date)
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

export function onlyRussianLetters(text: string): string {
    const englishC = 'c'
    const russianC = 'с'
    const englishCBig = 'C'
    const russianCBig = 'С'
    return text
        .replace(englishC, russianC)
        .replace(englishCBig, russianCBig)
}


export function cleanTimetableText(text: string): string {
    return text
        .replace(/[ ]+/g, ' ')
        .replace(/[;\s]$/g, '')
        .trim()
}

export function parseTimetable(input: string, now: Date): TimetableParseResult {
    const text = cleanTimetableText(input)
    let parseRes: Result<RawParseResult> = timetableLang.Everything.parse(text);
    // const fixYear = (date: string) => parse(date, 'yyyy-MM-dd')

    if (parseRes.status) {

        const dateValidation: string[] = []
        parseRes = fillUnknownYearsAndValidate(parseRes, dateValidation, subMonths(now, 3))
        if (dateValidation.length > 0) {
            return {status: false, errors: dateValidation}
        }

        const result: Omit<Required<EventTimetable>, 'anytimeComment'> & { anytimeComment?: string } = {
            dateRangesTimetable: [],
            datesExact: [],
            weekTimes: [],
            anytime: false,
        }
        for (const p of parseRes.value) {
            if (p.dateRange !== undefined) {
                result.dateRangesTimetable.push({
                    dateRange: p.dateRange,
                    weekTimes: p.weekTimes,
                    times: p.times
                })
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
                if (p.anytimeComment) {
                    result.anytimeComment = p.anytimeComment
                }
            }
        }
        return {status: parseRes.status, value: result}
    } else {
        const errors: string[] = []
        if (text.length === 0) {
            errors.push(`Пустая строка`)
        } else if (parseRes.index.offset === text.length) {
            errors.push(`После строки "${text}" я ожидала получить, например, следующее:`)
            parseRes.expected.forEach(e => errors.push(` - ${e}`))
            errors.push(`Но в строке больше ничего нет`)
        } else if (parseRes.index.offset === 0) {
            errors.push(`Не смогла понять что это: "${text}". Я ожидала одно из:`)
            parseRes.expected.forEach(e => errors.push(` - ${e}`))
        } else {
            errors.push(`После строки "${text.substr(0, parseRes.index.offset)}" я ожидала:`)
            parseRes.expected.forEach(e => errors.push(` - ${e}`))
            errors.push(`И текст "${text.substr(parseRes.index.offset)}" не подходит к вышеперечисленному`)
        }
        return {status: parseRes.status, errors: errors}
    }
}
