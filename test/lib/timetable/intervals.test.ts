import {
    filterByByRange,
    predictIntervals,
    MomentIntervals,
    mapInterval,
    subDateRange, DateOrDateRange
} from '../../../src/lib/timetable/intervals'
import { parseTimetable } from '../../../src/lib/timetable/parser'
import 'moment-timezone/index'
import { mskMoment } from '../../../src/util/moment-msk'
import moment, { Moment } from 'moment'

console.log('test1: ' + moment('2020-01-01 15:00').tz('Europe/Moscow', true).locale('en').toISOString(true))
console.log('test2: ' + moment('2020-01-01 15:00').tz('Europe/Moscow', true).locale('en').toISOString(false))
console.log('test3: ' + moment('2020-01-01 15:00').tz('Europe/Moscow', true).locale('en').format('HH:mm'))

function format(e: Moment) {
    return e.tz('Europe/Moscow').format('YYYY-MM-DD HH:mm')
}

function formatIntervals(actual: MomentIntervals) {
    return actual.map(e => Array.isArray(e) ? [format(e[0]), format(e[1])] : format(e))
}

describe('filterByByRange', () => {
    test.each([
        {
            line: [mskMoment('2020-01-01 15:00'), mskMoment('2020-01-01 16:00')],
            restrict: [mskMoment('2020-01-01 10:00'), mskMoment('2020-01-01 20:00')],
            restrictType: 'in',
            expected: [mskMoment('2020-01-01 15:00'), mskMoment('2020-01-01 16:00')]
        },
        {
            line: [mskMoment('2020-01-01'), mskMoment('2020-01-03')],
            restrict: [mskMoment('2020-01-01'), mskMoment('2020-01-03')],
            restrictType: 'in',
            expected: [mskMoment('2020-01-01')],
        },
        {
            line: [[mskMoment('2020-01-01'), mskMoment('2020-01-03')]],
            restrict: [mskMoment('2020-01-01'), mskMoment('2020-01-02')],
            restrictType: 'in',
            expected: [[mskMoment('2020-01-01'), mskMoment('2020-01-02')]],
        },
        {
            line: [[mskMoment('2020-01-03'), mskMoment('2020-01-08')]],
            restrict: [mskMoment('2020-01-02'), mskMoment('2020-01-06')],
            restrictType: 'in',
            expected: [[mskMoment('2020-01-03'), mskMoment('2020-01-06')]],
        },
        {
            line: [[mskMoment('2020-01-01'), mskMoment('2020-01-05')]],
            restrict: [mskMoment('2020-01-02'), mskMoment('2020-01-03')],
            restrictType: 'out',
            expected: [
                [mskMoment('2020-01-01'), mskMoment('2020-01-02')],
                [mskMoment('2020-01-03'), mskMoment('2020-01-05')]
            ],
        },
        {
            line: [[mskMoment('2020-01-01'), mskMoment('2020-01-05')]],
            restrict: [mskMoment('2020-01-02'), mskMoment('2020-01-08')],
            restrictType: 'out',
            expected: [[mskMoment('2020-01-01'), mskMoment('2020-01-02')]],
        },
        {
            line: [[mskMoment('2020-01-02'), mskMoment('2020-01-10')]],
            restrict: [mskMoment('2020-01-02'), mskMoment('2020-01-08')],
            restrictType: 'out',
            expected: [[mskMoment('2020-01-08'), mskMoment('2020-01-10')]],
        },
        {
            line: [mskMoment('2020-01-08'), mskMoment('2020-01-10')],
            restrict: [mskMoment('2020-01-02'), mskMoment('2020-01-08')],
            restrictType: 'out',
            expected: [mskMoment('2020-01-08'), mskMoment('2020-01-10')],
        },
        {
            line: [[mskMoment('2020-01-04 11:00'), mskMoment('2020-01-04 22:00')]],
            restrict: [mskMoment('2020-01-07'), mskMoment('2020-01-08')],
            restrictType: 'out',
            expected: [[mskMoment('2020-01-04 11:00'), mskMoment('2020-01-04 22:00')]],
        },
    ])('%s', (c: any) => {
        const actual = filterByByRange(c.line, c.restrict, c.restrictType)

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
        //
        // mskMoment().isoWeekday(1);
    ])('%s', (text, expected: any) => {
        const timetable = parseTimetable(text)
        if (timetable.status === true) {
            const intervals = predictIntervals(mskMoment('2020-01-01 01:00:00'), timetable.value)

            const formatIntervals = intervals.map(i =>
                mapInterval(i, (ms) => ms.tz('Europe/Moscow').format('YYYY-MMM-DD HH:mm'))
            )

            expect(formatIntervals).toStrictEqual(expected)
        } else {
            fail(timetable.errors.join('\n'))
        }
    });
});