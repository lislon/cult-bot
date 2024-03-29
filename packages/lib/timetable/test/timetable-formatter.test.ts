import { date } from './test-utils'
import { FormatterConfig, TimetableFormatter } from '../src'
import { parseTimetable } from '../src'


// январь 2020
// пн	вт	ср	чт	пт	сб	вс
//           1	2	3	4	5
// 6	7	8	9	10	11	12
// 13	14	15	16	17	18	19
// 20	21	22	23	24	25	26
// 27	28	29	30	31
const NOW = date('2020-01-01 15:00')

function expectWillBeFormatted(expected: string, text: string = expected, now: Date = NOW, config: FormatterConfig = {}): void {
    const timetable = parseTimetable(text, now)
    if (timetable.status === false) {
        throw new Error('failed to parse: ' + text + '\n' + timetable.errors.join('\n'))
    }
    const result = new TimetableFormatter(now, config).formatTimetable(timetable.value)
    expect(result).toEqual(expected)
}

describe('timetable formatter', () => {

    test('anytime', () => {
        expectWillBeFormatted('в любое время')
    })
    test('anytime with comment', () => {
        expectWillBeFormatted('в любое время (по записи)')
    })
    test('time_multiply_with_range', () => {
        expectWillBeFormatted(`сб: 10:00–12:00, 14:00`)
    })

    test('week_regular_single', () => {
        expectWillBeFormatted('сб: 10:00')
    })

    test('week_regular_range', () => {
        expectWillBeFormatted('пн,сб–вс: 10:00')
    })

    test('concrete_dates_single_far', () => {
        const input = `12 января 2020: 10:00`
        const expected = '12 января 2020: 10:00'
        expectWillBeFormatted(expected, input, new Date(2000, 1, 1))
    })

    test('concrete_dates_single_short', () => {
        const input = `12 января 2020: 10:00`
        const expected = '12 января: 10:00'
        expectWillBeFormatted(expected, input)
    })

    test('concrete_dates_dual_short', () => {
        const input = `12 января 2020: 10:00; 13 января 2020: 10:00`
        const expected = '12 января: 10:00\n13 января: 10:00'
        expectWillBeFormatted(expected, input)
    })

    test('concrete_dates_range_far', () => {
        expectWillBeFormatted('12 января 2020 — 12 января 2030: 10:00')
    })

    test('concrete_dates_range_short_diff_months', () => {
        expectWillBeFormatted(`28 января — 01 февраля: 10:00`)
    })

    test('concrete_dates_range_short_same_months', () => {
        const input = `25 января 2020 - 28 января 2020: 10:00`
        const expected = `25-28 января: 10:00`
        expectWillBeFormatted(expected, input)
    })

    test('week_regular + concrete_dates_single_short', () => {
        const expected = `сб: 10:00\n12 января: 10:00`
        expectWillBeFormatted(expected)
    })

    test('week_regular + comment', () => {
        const expected = `сб: 10:00 (Давай давай)`
        expectWillBeFormatted(expected)
    })

    test('reversive weekdays normalization', () => {
        const expected = [
            `ср,пт–вс: 10:00–18:00`,
            `пн: 10:00–20:00`,
            `чт: 13:00, 14:00, 15:00, 16:00, 18:00 (по сеансам)`].join('\n')
        expectWillBeFormatted(expected)
    })

    test('week_range_every_day', () => {
        const input = `25 января 2020 - 28 января 2020: в любое время`
        const expected = `25-28 января: в любое время`
        expectWillBeFormatted(expected, input)
    })

    test('date_exact + comment', () => {
        const input = `25 января 2020: в любое время (Ку-ку рябята)`
        const expected = `25 января: в любое время (Ку-ку рябята)`
        expectWillBeFormatted(expected, input)
    })

    test('concrete_dates_hide_past', () => {
        const input = `12 декабря 2019: 10:00\n12 января 2020: 10:00`
        const expected = '12 января: 10:00'
        expectWillBeFormatted(expected, input, NOW, {hidePast: true})
    })

    test('hide past on last date time', () => {
        const input = `12 декабря 2019: 10:00,20:00\n13 января 2020: 10:00, 20:00`
        const expected = '13 января: 10:00, 20:00'
        expectWillBeFormatted(expected, input, date('2020-01-13 15:00'), {hidePast: true})
    })

    test('do hide past event by default', () => {
        const input = `12 декабря 2018: 10:00, 20:00`
        expectWillBeFormatted(input, input, date('2020-01-13 15:00'))
    })

    test('cinema', () => {
        const input = [
            `17 января: 11:30–23:45 (https://afisha.yandex.ru/saint-petersburg/cinema/dovod?source=search-page&schedule-preset=tomorrow)`,
            `18 января: 11:30–23:45 (https://afisha.yandex.ru/saint-petersburg/cinema/dovod?source=search-page&schedule-date=2020-10-18)`
        ].join('\n')
        expectWillBeFormatted(input, input, NOW, {hidePast: true})
    })

    test('remove first part of range if flag', () => {
        const input = '12 ноября 2019 - 29 ноября 2021: сб-вс: 10:00-18:00'
        const expected = 'до 29 ноября 2021: сб–вс: 10:00–18:00'
        expectWillBeFormatted(expected, input, NOW, {hidePast: true})
    })

    describe('hide past', () => {

        test('concrete_dates_range_short_same_months', () => {
            const input = `25 января 2020 - 28 января 2020: 10:00`
            const expected = `25-28 января`
            expectWillBeFormatted(expected, input, NOW, {hideTimes: true})
        })

        test('remove first part of range if flag', () => {
            const input = '12 ноября 2019 – 29 ноября 2021: сб-вс: 10:00–18:00'
            const expected = 'до 29 ноября 2021: сб–вс'
            expectWillBeFormatted(expected, input, NOW, {hidePast: true, hideTimes: true})
        })

        test('do not hide past if nothing will be displayed', () => {
            const input = '12 ноября 2019 - 29 ноября 2019: сб-вс: 10:00-18:00'
            const expected = 'до 29 ноября: сб–вс'
            expectWillBeFormatted(expected, input, NOW, {hidePast: true, hideTimes: true})
        })

        test('week_regular + comment', () => {
            const input = `сб: 10:00 (Давай давай)`
            const expected = `сб (Давай давай)`
            expectWillBeFormatted(expected, input, NOW, {hideTimes: true})
        })
    })

    describe('hide regular', () => {

        const config: FormatterConfig = {hideNonHolidays: true}

        test('intervals not affected', () => {
            const input = `25-28 января: 10:00`
            expectWillBeFormatted(input, input, NOW, config)
        })

        test('week_regular are hidden', () => {
            const input = `пн-сб: 10:00`
            const expected = `сб: 10:00`
            expectWillBeFormatted(expected, input, NOW, config)
        })

        test('week_range are hidden', () => {
            const input = '12-29 ноября: пн-вс: 10:00-18:00'
            const expected = `12-29 ноября: сб–вс: 10:00–18:00`
            expectWillBeFormatted(expected, input, NOW, config)
        })

        test('exact_days are hidden', () => {
            const input = `03 января: 10:00\n04 января: 10:00`
            const expected = '04 января: 10:00'
            expectWillBeFormatted(expected, input, NOW, config)
        })

        test('when all days are hidden, show as is', () => {
            const input = '12-29 ноября: пн-вт: 10:00-18:00'
            const expected = `12-29 ноября: пн–вт: 10:00–18:00`
            expectWillBeFormatted(expected, input, NOW, config)
        })
    })

    describe('hide regular + holidays', () => {

        const config: FormatterConfig = {hideNonHolidays: true, holidays: [date('2020-01-01'), date('2020-01-02')]}
        test('intervals not affected', () => {
            const input = `01-28 января: 10:00`
            expectWillBeFormatted(input, input, NOW, config)
        })

        test('week_regular are hidden', () => {
            const input = `пн-вс: 10:00`
            const expected = `ср–чт: 10:00`
            expectWillBeFormatted(expected, input, NOW, config)
        })

        test('exact_days are hidden', () => {
            const input = `02 января: 10:00\n03 января: 10:00`
            const expected = '02 января: 10:00'
            expectWillBeFormatted(expected, input, NOW, config)
        })
    })

    describe('hide future dates for theatres', () => {
        test('only first future date is shown', () => {
            const input = `02 января: 10:00\n03 января: 10:00\n\n04 января: 10:00\n`
            const expected = '03 января: 10:00'
            expectWillBeFormatted(expected, input, date('2020-01-02 15:00'), {
                hidePast: true,
                hideFutureExactDates: true
            })
        })
    })

})
