import { filterByRange, mapInterval, MomentIntervals, predictIntervals } from '../../../src/lib/timetable/intervals'
import { parseTimetable } from '../../../src/lib/timetable/parser'
import { date, interval } from './test-utils'
import { format } from 'date-fns'


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
            restrict: interval('[2020-01-01 10:00, 2020-01-01 20:00)'),
            restrictType: 'in',
            expected: [date('2020-01-01 15:00'), date('2020-01-01 16:00')]
        },
        {
            event: [date('2020-01-01'), date('2020-01-03')],
            restrict: interval('[2020-01-01, 2020-01-03)'),
            restrictType: 'in',
            expected: [date('2020-01-01')],
        },
        {
            event: [[date('2020-01-01'), date('2020-01-03')]],
            restrict: interval('[2020-01-01, 2020-01-02)'),
            restrictType: 'in',
            expected: [[date('2020-01-01'), date('2020-01-02')]],
        },
        {
            event: [[date('2020-01-03'), date('2020-01-08')]],
            restrict: interval('[2020-01-02, 2020-01-06)'),
            restrictType: 'in',
            expected: [[date('2020-01-03'), date('2020-01-06')]],
        },
        {
            event: [[date('2020-01-01'), date('2020-01-05')]],
            restrict: interval('[2020-01-02, 2020-01-03)'),
            restrictType: 'out',
            expected: [
                [date('2020-01-01'), date('2020-01-02')],
                [date('2020-01-03'), date('2020-01-05')]
            ],
        },
        {
            event: [[date('2020-01-01'), date('2020-01-05')]],
            restrict: interval('[2020-01-02, 2020-01-08)'),
            restrictType: 'out',
            expected: [[date('2020-01-01'), date('2020-01-02')]],
        },
        {
            event: [[date('2020-01-02'), date('2020-01-10')]],
            restrict: interval('[2020-01-02, 2020-01-08)'),
            restrictType: 'out',
            expected: [[date('2020-01-08'), date('2020-01-10')]],
        },
        {
            event: [date('2020-01-08'), date('2020-01-10')],
            restrict: interval('[2020-01-02, 2020-01-08)'),
            restrictType: 'out',
            expected: [date('2020-01-08'), date('2020-01-10')],
        },
        {
            event: [[date('2020-01-04 11:00'), date('2020-01-04 22:00')]],
            restrict: interval('[2020-01-07, 2020-01-08)'),
            restrictType: 'out',
            expected: [[date('2020-01-04 11:00'), date('2020-01-04 22:00')]],
        },
    ])('%s', (c: any) => {
        const actual = filterByRange(c.event, c.restrict, c.restrictType)

        expect(formatIntervals(actual)).toStrictEqual(formatIntervals(c.expected))
    });
});

// январь 2020
// пн	вт	ср	чт	пт	сб	вс
//          1	2	3	4	5
// 6	7	8	9	10	11	12
// 13	14	15	16	17	18	19
// 20	21	22	23	24	25	26
// 27	28	29	30	31

describe('integration', () => {
    test.each([
        [
            'в любое время',
            [
                [
                    '2020-Jan-01 01:00',
                    '2020-Jan-08 00:00'
                ]
            ]
        ],
        [
            'с 1 января 2020 до 2 января 2020: в любое время',
            [
                [
                    '2020-Jan-01 01:00', '2020-Jan-02 00:00'
                ],
                [
                    '2020-Jan-02 00:00', '2020-Jan-03 00:00'
                ],
            ]
        ],
        [
            'с 4 января 2020 до 24 декабря 2020: пн-вт: 11:00-20:00, ср: 11:00-21.00, чт-вс: 11:00-22:00',
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
            ]
        ],
        [
            'с 4 января 2020 до 24 декабря 2020: 11:00-22:00',
            [
                ['2020-Jan-04 11:00', '2020-Jan-04 22:00'],
                ['2020-Jan-05 11:00', '2020-Jan-05 22:00'],
                ['2020-Jan-06 11:00', '2020-Jan-06 22:00'],
                ['2020-Jan-07 11:00', '2020-Jan-07 22:00']
            ]
        ],
        [
            'с 4 января 2020 до 8 января 2020: 11:00-22:00; 5 января 2020: 15:00',
            [
                ['2020-Jan-04 11:00', '2020-Jan-04 22:00'],
                '2020-Jan-05 15:00',
                ['2020-Jan-06 11:00', '2020-Jan-06 22:00'],
                ['2020-Jan-07 11:00', '2020-Jan-07 22:00'],
            ]
        ],
        [
            'пн: 10:00-15:00',
            [
                [
                    '2020-Jan-06 10:00',
                    '2020-Jan-06 15:00'
                ]
            ]
        ],
        [
            'ср: 00:00-15:00',
            [
                [
                    '2020-Jan-01 01:00',
                    '2020-Jan-01 15:00'
                ]
            ]
        ],
        [
            '1 декабря 2019 - 1 февраля 2020:\n' +
            'суб-воскр: с 12:00 до 18:00',
            [
                [
                    '2020-Jan-04 12:00',
                    '2020-Jan-04 18:00'
                ],
                [
                    '2020-Jan-05 12:00',
                    '2020-Jan-05 18:00'
                ]
            ]
        ],
        [
            '1 декабря 2019 - 1 февраля 2020: с 12 до 20',
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
            ]
        ]
    ])('%s', (text, expected: any) => {
        const timetable = parseTimetable(text)
        if (timetable.status === true) {
            const intervals = predictIntervals(date('2020-01-01 01:00'), timetable.value, 7)

            const formatIntervals = intervals.map(i =>
                mapInterval(i, (ms) => format(ms, 'yyyy-MMM-dd HH:mm'))
            )

            expect(formatIntervals).toStrictEqual(expected)
        } else {
            fail(timetable.errors.join('\n'))
        }
    });
});