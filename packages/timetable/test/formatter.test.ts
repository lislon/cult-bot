import { date } from './test-utils'
import { TimetableConfig, TimetableFormatter } from '../src'
import { parseTimetable } from '../src'

const NOW = date('2020-01-01 15:00')

function expectWillBeFormatted(expected: string, text: string = expected, now: Date = NOW, config: TimetableConfig = {}): void {
    const timetable = parseTimetable(text, now)
    if (timetable.status === false) {
        throw new Error('failed to parse: ' + text + '\n' + timetable.errors.join('\n'))
    }
    const result = new TimetableFormatter(now, config).formatTimetable(timetable.value)
    expect(result).toEqual(expected)
}

describe('timetable formatter', () => {

    test('anytime', () => {
        expectWillBeFormatted('В любое время');
    })

    test('time_multiply_with_range', () => {
        expectWillBeFormatted(`сб: 10:00-12:00,14:00`);
    })

    test('week_regular_single', () => {
        expectWillBeFormatted('сб: 10:00');
    })

    test('week_regular_range', () => {
        expectWillBeFormatted('пн,сб-вс: 10:00');
    })

    test('concrete_dates_single_far', () => {
        const input = `12 января 2020: 10:00`
        const expected = '12 января 2020: 10:00'
        expectWillBeFormatted(expected, input, new Date(2000, 1, 1));
    })

    test('concrete_dates_single_short', () => {
        const input = `12 января 2020: 10:00`;
        const expected = '12 января: 10:00'
        expectWillBeFormatted(expected, input);
    })

    test('concrete_dates_dual_short', () => {
        const input = `12 января 2020: 10:00; 13 января 2020: 10:00`;
        const expected = '12 января: 10:00\n13 января: 10:00'
        expectWillBeFormatted(expected, input);
    })

    test('concrete_dates_range_far', () => {
        expectWillBeFormatted('12 января 2020 - 12 января 2030: 10:00');
    })

    test('concrete_dates_range_short_diff_months', () => {
        expectWillBeFormatted(`28 января - 01 февраля: 10:00`);
    })

    test('concrete_dates_range_short_same_months', () => {
        const input = `25 января 2020 - 28 января 2020: 10:00`;
        const expected = `25-28 января: 10:00`;
        expectWillBeFormatted(expected, input);
    })

    test('week_regular + concrete_dates_single_short', () => {
        const expected = `сб: 10:00\n12 января: 10:00`;
        expectWillBeFormatted(expected);
    })

    test('week_range_every_day', () => {
        const input = `25 января 2020 - 28 января 2020: в любое время`;
        const expected = `25-28 января: 00:00-24:00`;
        expectWillBeFormatted(expected, input);
    })

    test('concrete_dates_hide_past', () => {
        const input = `12 декабря 2019: 10:00\n12 января 2020: 10:00`;
        const expected = '12 января: 10:00'
        expectWillBeFormatted(expected, input, NOW, {hidePast: true});
    })
})
