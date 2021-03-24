import { EventPrice } from './price-parser'
import * as P from 'parsimmon'
import { Result } from 'parsimmon'

export type EventDuration = {
    parts: PartDuration[]
} | 'unknown'

export interface PartDuration {
    title?: string
    min: number // seconds
    max?: number // seconds
    comment?: string
}
//
// interface RawParseResult {
//     [Symbol.iterator](): Iterator<RawParseResultV>;
// }

const durationLang = P.createLanguage({
    Days: () => P.regexp(/([0-9]+)\s*(дня|дней|день)/i, 1).map(parseInt).desc('Дней'),
    Hour: () => P.regexp(/([0-2]?[0-9])\s*(ч|часов)/i, 1).map(parseInt).desc('Часов'),
    Minute: () => P.regexp(/([0-6]?[0-9])\s*(мин|минут)/, 1).map(parseInt).desc('Минут'),
    DurationSingle: (r) =>
            P.seq(r.Days.fallback(0), r._, r.Hour.fallback(0), r._, r.Minute.fallback(0))
                .map(([d, , h, , m]) => ((d * 24 + h) + m) * 60)
                .assert(seconds => seconds > 0, 'duration should not be 0'),
    MoreThenDurationSingle: (r) => P.seq(r.MoreThen, r._, r.DurationSingle).map(([,, durationSingle]) => durationSingle),
    ['(']: () => P.string('(').desc('('),
    [')']: () => P.string(')').desc(')'),
    MoreThen: () => P.alt(P.string('более'), P.string('от'))
        .contramap(str => str.toLowerCase())
        .desc('Слово более'),
    // To: () => stringIgnoreCase('до').desc('фраза "до"'),
    // ToDate: () => P.alt(stringIgnoreCase('до'), stringIgnoreCase('по')),
    TextInBraces: () => P.regex(/[(]([^)]+)[)]/, 1).desc('текст в скобках'),
    _: () => P.regex(/[^\S\r\n]*/).desc('пробелы'),
    __: () => P.regex(/[^\S\r\n]+/).desc('пробелы'),
})


export function parseDuration(text: string): EventDuration {
    const parseRes: Result<number> = durationLang.DurationSingle.parse(text)

    return 'unknown'
}