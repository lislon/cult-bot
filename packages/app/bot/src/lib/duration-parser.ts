import { EventPrice } from './price-parser'
import * as P from 'parsimmon'
import { Result } from 'parsimmon'

export type EventDuration = PartDuration[] | 'unknown'

export interface PartDuration {
    title?: string
    min: number // seconds
    max?: number // seconds
    comment?: string
}

type Unit = 'day' | 'hour' | 'minute'

function toUnits(num: number | string, unit: Unit) {
    switch (unit) {
        case 'day':
            return +num * 24 * 60 * 60
        case 'hour':
            return +num * 60 * 60
        case 'minute':
            return +num * 60
    }
}

const durationLang = P.createLanguage({
    DayLabel: (r) => P.regexp(/(д|дня|дней|день)(?![а-яА-я\w])/i).desc('Дней').result<Unit>('day'),
    HourLabel: () => P.regexp(/(ч|часов|часа)(?![а-яА-я\w])/i).desc('Часов').result<Unit>('hour'),
    MinuteLabel: () => P.regexp(/(м|мин|минут|минуты)(?![а-яА-я\w])/i).desc('Минут').result<Unit>('minute'),
    DaysN: (r) => P.seq(r.Number, r._, r.DayLabel).map(([n, , unit]) => toUnits(n, unit)),
    HoursN: (r) => P.seq(r.Number, r._, r.HourLabel).map(([n, , unit]) => toUnits(n, unit)),
    MinutesN: (r) => P.seq(r.Number, r._, r.MinuteLabel).map(([n, , unit]) => toUnits(n, unit)),
    DurationRaw: (r) => P.alt(
        P.seq(r.DaysN, r._, r.HoursN, r._, r.MinutesN).map(([d, , h, , m]) => d + h + m),
        P.seq(r.DaysN, r._, r.HoursN).map(([d, , h]) => d + h),
        P.seq(r.HoursN, r._, r.MinutesN).map(([h, , m]) => h + m),
        r.DaysN,
        r.HoursN,
        r.MinutesN),
    DurationSingle: (r) => r.DurationRaw.map(raw => {
        return {min: raw, max: raw}
    }).desc('1ч'),
    DurationDoubleStyle1: (r) => P.seq(r.DurationRaw, r._, r['-'], r._, r.DurationRaw).map(([min, , , , max]) => {
        return {min, max}
    }).desc('30м-2ч'),
    DurationDoubleStyle2: (r) => P.seq(r.Number, r._, r['-'], r._, r.Number, r._, P.alt(r.DayLabel, r.HourLabel, r.MinuteLabel))
        .map(([min, , , , max, , unit]) => ({
            min: toUnits(min, unit),
            max: toUnits(max, unit),
        })).desc('1-2ч'),
    DurationDoubleStyle3: (r) => P.seq(r.MoreThen, r.__, r.Number, r.__, r.LessThen, r.__, r.Number, r._, P.alt(r.DayLabel, r.HourLabel, r.MinuteLabel))
        .map(([, , min, , , , max, , unit]) => ({
            min: toUnits(min, unit),
            max: toUnits(max, unit),
        })).desc('от 1 до 2ч'),
    DurationDoubleStyle4: (r) => P.seq(r.MoreThen, r.__, r.DurationRaw, r.__, r.LessThen, r.__, r.DurationRaw)
        .map(([, , min, , , , max]) => ({
            min,
            max,
        })).desc('от 30 мин до 2ч'),
    MoreThenDurationSingle: (r) => P.seq(r.MoreThen, r.__, r.DurationRaw)
        .map(([, , min]) => ({min, max: undefined}))
        .desc('Более чем N ч'),
    AnyDuration: (r) => P.alt(
        r.DurationDoubleStyle4,
        r.DurationDoubleStyle3,
        r.DurationDoubleStyle2,
        r.DurationDoubleStyle1,
        r.MoreThenDurationSingle,
        r.DurationSingle
    ),
    PartWithTitle: (r) => P.seq(r.PartName, r._, r.AnyDuration, r._, r.MaybeComment)
        .map(([title, , duration, , comment]) => ({title, ...duration, comment})),
    PartWithoutTitle: (r) => P.seq(r.AnyDuration, r._, r.MaybeComment)
        .map(([duration, , comment]) => ({...duration, comment})),
    Parts: (r) => P.alt(
        P.seq(r.PartWithTitle, r.Divider, r.PartWithTitle, r.Divider, r.PartWithTitle).map(([part1, , part2, , part3]) => ([part1, part2, part3])),
        P.seq(r.PartWithTitle, r.Divider, r.PartWithTitle).map(([part1, , part2]) => ([part1, part2])),
        r.PartWithoutTitle.map(part => [part])
    ),
    Divider: (r) => P.seq(r._, P.alt(r[';'], r.NewLine), r._),
    NewLine: () => P.regex(/[\n\r]+/).desc('новая строка'),
    Number: () => P.regex(/\d+/).desc('число'),
    [';']: () => P.string(';').desc('точка с запятой'),
    ['(']: () => P.string('(').desc('('),
    [')']: () => P.string(')').desc(')'),
    MoreThen: () => P.regex(/(более|от)/i).desc('Более/от'),
    PartName: () => P.regex(/\s*([^:\n;]+):/, 1).desc('Название части:'),
    // PartName: () => P.regex(/(x):/, 1).desc('Название части:'),
    LessThen: () => P.regex(/до/i).desc('до'),
    MaybeComment: () => P.regex(/\s*[(]([^)]+)[)]/, 1).desc('Комментарий в скобках').fallback(undefined),
    ['-']: () => P.oneOf('-—‑–－﹘').desc('диапазон через дефис'),
    [':']: () => P.string(':'),
    _: () => P.regex(/[^\S\r\n]*/).desc('пробелы'),
    __: () => P.regex(/[^\S\r\n]+/).desc('обязательные пробелы'),
})


export function parseDuration(text: string): Result<PartDuration[]> {
    return durationLang.Parts.parse(text)
}

export function parseDurationSimple(text: string): EventDuration {
    const result = parseDuration(text)
    return result.status === true ? result.value : 'unknown'
}