import { filterByRange, mapInterval, predictIntervals } from '../src/intervals'

import { date, mkInterval } from './test-utils'
import { format } from 'date-fns'
import { MomentIntervals, parseTimetable } from '../src'


function format2(e: Date) {
    return format(e, 'yyyy-MM-dd HH:mm')
}

function formatIntervals(actual: MomentIntervals) {
    return actual.map(e => Array.isArray(e) ? [format2(e[0]), format2(e[1])] : format2(e))
}

describe('filterByRange', () => {
    test.each([
        {
            event: [date('2020-01-01 15:00'), date('2020-01-01 16:00')],
            restrict: mkInterval('[2020-01-01 10:00, 2020-01-01 20:00)'),
            restrictType: 'in',
            expected: [date('2020-01-01 15:00'), date('2020-01-01 16:00')]
        },
        {
            event: [date('2020-01-01'), date('2020-01-03')],
            restrict: mkInterval('[2020-01-01, 2020-01-03)'),
            restrictType: 'in',
            expected: [date('2020-01-01')],
        },
        {
            event: [[date('2020-01-01'), date('2020-01-03')]],
            restrict: mkInterval('[2020-01-01, 2020-01-02)'),
            restrictType: 'in',
            expected: [[date('2020-01-01'), date('2020-01-02')]],
        },
        {
            event: [[date('2020-01-03'), date('2020-01-08')]],
            restrict: mkInterval('[2020-01-02, 2020-01-06)'),
            restrictType: 'in',
            expected: [[date('2020-01-03'), date('2020-01-06')]],
        },
        {
            event: [[date('2020-01-01'), date('2020-01-05')]],
            restrict: mkInterval('[2020-01-02, 2020-01-03)'),
            restrictType: 'out',
            expected: [
                [date('2020-01-01'), date('2020-01-02')],
                [date('2020-01-03'), date('2020-01-05')]
            ],
        },
        {
            event: [[date('2020-01-01'), date('2020-01-05')]],
            restrict: mkInterval('[2020-01-02, 2020-01-08)'),
            restrictType: 'out',
            expected: [[date('2020-01-01'), date('2020-01-02')]],
        },
        {
            event: [[date('2020-01-02'), date('2020-01-10')]],
            restrict: mkInterval('[2020-01-02, 2020-01-08)'),
            restrictType: 'out',
            expected: [[date('2020-01-08'), date('2020-01-10')]],
        },
        {
            event: [date('2020-01-08'), date('2020-01-10')],
            restrict: mkInterval('[2020-01-02, 2020-01-08)'),
            restrictType: 'out',
            expected: [date('2020-01-08'), date('2020-01-10')],
        },
        {
            event: [[date('2020-01-04 11:00'), date('2020-01-04 22:00')]],
            restrict: mkInterval('[2020-01-07, 2020-01-08)'),
            restrictType: 'out',
            expected: [[date('2020-01-04 11:00'), date('2020-01-04 22:00')]],
        },
    ])('%s', (c: any) => {
        const actual = filterByRange(c.event, c.restrict, c.restrictType)

        expect(formatIntervals(actual)).toStrictEqual(formatIntervals(c.expected))
    })
})

// январь 2020
// пн	вт	ср	чт	пт	сб	вс
//          1	2	3	4	5
// 6	7	8	9	10	11	12
// 13	14	15	16	17	18	19
// 20	21	22	23	24	25	26
// 27	28	29	30	31

type TestOptions = { start?: Date, daysAhead?: number }
describe('integration', () => {

    function assert2(text: string,
                     expected: any,
                     {start = date('2020-01-01 01:00'), daysAhead = 7}: TestOptions = {}) {
        const timetable = parseTimetable(text, start)
        if (timetable.status === true) {
            const intervals = predictIntervals(start, timetable.value, daysAhead)

            const formatIntervals = intervals.map((i: Date | Date[]) =>
                mapInterval(i, (ms) => format(ms, 'yyyy-MMM-dd HH:mm'))
            )

            expect(formatIntervals).toStrictEqual(expected)
        } else {
            throw new Error(timetable.errors.join('\n'))
        }
    }

    test('в любое время', () => {
        assert2('в любое время',
            [
                [
                    '2020-Jan-01 01:00',
                    '2020-Jan-08 00:00'
                ]
            ])
    })

    test('date range with time range', () => {
        assert2('15 января 2020 - 17 декабря 2020: 12:00 - 20:00',
            [
                [
                    '2020-May-01 15:00',
                    '2020-May-01 20:00'
                ],
                [
                    '2020-May-02 12:00',
                    '2020-May-02 20:00'
                ],
                [
                    '2020-May-03 12:00',
                    '2020-May-03 20:00'
                ]
            ], {start: date('2020-05-01 15:00'), daysAhead: 3})
    })

    test('date range with anytime', () => {
        assert2('с 1 января 2020 до 2 января 2020: в любое время',
            [
                [
                    '2020-Jan-01 01:00', '2020-Jan-02 00:00'
                ],
                [
                    '2020-Jan-02 00:00', '2020-Jan-03 00:00'
                ],
            ])
    })

    test('date range with weekdays', () => {
        assert2('с 4 января 2020 до 24 декабря 2020: пн-вт: 11:00-20:00, ср: 11:00-21.00, чт-вс: 11:00-22:00',
            [
                [
                    '2020-Jan-04 11:00', '2020-Jan-04 22:00'
                ],
                [
                    '2020-Jan-05 11:00', '2020-Jan-05 22:00'
                ],
                [
                    '2020-Jan-06 11:00', '2020-Jan-06 20:00'
                ],
                [
                    '2020-Jan-07 11:00', '2020-Jan-07 20:00'
                ]
            ])
    })

    test('date range with text delimiters', () => {
        assert2('с 4 января 2020 до 24 декабря 2020: 11:00-22:00',
            [
                ['2020-Jan-04 11:00', '2020-Jan-04 22:00'],
                ['2020-Jan-05 11:00', '2020-Jan-05 22:00'],
                ['2020-Jan-06 11:00', '2020-Jan-06 22:00'],
                ['2020-Jan-07 11:00', '2020-Jan-07 22:00']
            ])
    })

    test('date range with exact days', () => {
        assert2('с 4 января 2020 до 8 января 2020: 11:00-22:00; 5 января 2020: 15:00',
            [
                ['2020-Jan-04 11:00', '2020-Jan-04 22:00'],
                '2020-Jan-05 15:00',
                ['2020-Jan-06 11:00', '2020-Jan-06 22:00'],
                ['2020-Jan-07 11:00', '2020-Jan-07 22:00'],
            ])
    })

    test('single weekday', () => {
        assert2('пн: 10:00-15:00',
            [
                [
                    '2020-Jan-06 10:00',
                    '2020-Jan-06 15:00'
                ]
            ])
    })

    test('single weekday from middle of now', () => {
        assert2('ср: 00:00-15:00',
            [
                [
                    '2020-Jan-01 01:00',
                    '2020-Jan-01 15:00'
                ]
            ])
    })

    test('date range with week-range with time range', () => {
        assert2('1 декабря 2019 - 1 февраля 2020:\nсуб-воскр: с 12:00 до 18:00',
            [
                [
                    '2020-Jan-04 12:00',
                    '2020-Jan-04 18:00'
                ],
                [
                    '2020-Jan-05 12:00',
                    '2020-Jan-05 18:00'
                ]
            ])
    })

    test('very big range [ date range    [today; +7 days]     ]', () => {
        assert2('30 июля 2020 - 17 октября 2020: 12:00 - 20:00',
            [
                [
                    '2020-Oct-17 12:00',
                    '2020-Oct-17 20:00'
                ],
            ], {daysAhead: 7, start: date('2020-10-17 00:00')})
    })

    test('range overlaps date-ranges', () => {
        assert2(
            '1 января 2020 - 4 января 2020: 01:01;' +
            '2 января 2020 - 3 января 2020: 02:02',
            [
                '2020-Jan-01 01:01',
                '2020-Jan-02 02:02',
                '2020-Jan-03 02:02',
                '2020-Jan-04 01:01'
            ], {daysAhead: 7, start: date('2020-01-01 00:00')})
    })

    test('range overlaps complex', () => {
        assert2(
            '1 января 2020 - 5 января 2020: пн-вс: 00:00;' +
            '1 января 2020 - 4 января 2020: 01:01;' +
            '2 января 2020 - 3 января 2020: 02:02;' +
            '3 января 2020: 03:03;' +
            'пн-вс: 04:04;'
            ,
            [
                '2020-Jan-01 01:01',
                '2020-Jan-02 02:02',
                '2020-Jan-03 03:03',
                '2020-Jan-04 01:01',
                '2020-Jan-05 00:00',
                '2020-Jan-06 04:04',
                '2020-Jan-07 04:04'
            ], {daysAhead: 7, start: date('2020-01-01 00:00')})
    })

    test('ranges are limited by dates', () => {
        assert2('1 декабря 2019 - 1 февраля 2020: с 12 до 20',
            [
                [
                    '2020-Jan-01 12:00',
                    '2020-Jan-01 20:00'
                ],
                [
                    '2020-Jan-02 12:00',
                    '2020-Jan-02 20:00'
                ],
                [
                    '2020-Jan-03 12:00',
                    '2020-Jan-03 20:00'
                ],
                [
                    '2020-Jan-04 12:00',
                    '2020-Jan-04 20:00'
                ],
                [
                    '2020-Jan-05 12:00',
                    '2020-Jan-05 20:00'
                ],
                [
                    '2020-Jan-06 12:00',
                    '2020-Jan-06 20:00'
                ],
                [
                    '2020-Jan-07 12:00',
                    '2020-Jan-07 20:00'
                ]
            ])
    })

    test('ranges are limited by dates start before range start', () => {
        assert2('03 января 2020 - 10 января 2020: в любое время',
            [
                [
                    '2020-Jan-03 00:00',
                    '2020-Jan-04 00:00'
                ],
            ], {start: date('2020-01-01 01:00'), daysAhead: 3})
    })

    test('date range in past', () => {
        assert2('03 января 2020 - 10 января 2020: в любое время', [], {start: date('2020-03-15'), daysAhead: 30})
    })

})