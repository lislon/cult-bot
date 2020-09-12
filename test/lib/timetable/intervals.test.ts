import moment, { Moment } from 'moment'
import { filterByByRange, predictIntervals, MomentIntervals, mapInterval } from '../../../src/lib/timetable/intervals'
import { parseTimetable } from '../../../src/lib/timetable/parser'

function format(e: Moment) {
    return e.format('YYYY-MM-DD HH:mm')
}

function formatIntervals(actual: MomentIntervals) {
    return actual.map(e => Array.isArray(e) ? [format(e[0]), format(e[1])] : format(e))
}

describe('filterByByRange', () => {
    test.each([
        {
            line: [moment('2020-01-01 15:00'), moment('2020-01-01 16:00')],
            restrict: [moment('2020-01-01 10:00'), moment('2020-01-01 20:00')],
            restrictType: 'in',
            expected: [moment('2020-01-01 15:00'), moment('2020-01-01 16:00')]
        },
        {
            line: [moment('2020-01-01'), moment('2020-01-03')],
            restrict: [moment('2020-01-01'), moment('2020-01-03')],
            restrictType: 'in',
            expected: [moment('2020-01-01')],
        },
        {
            line: [[moment('2020-01-01'), moment('2020-01-03')]],
            restrict: [moment('2020-01-01'), moment('2020-01-02')],
            restrictType: 'in',
            expected: [[moment('2020-01-01'), moment('2020-01-02')]],
        },
        {
            line: [[moment('2020-01-03'), moment('2020-01-08')]],
            restrict: [moment('2020-01-02'), moment('2020-01-06')],
            restrictType: 'in',
            expected: [[moment('2020-01-03'), moment('2020-01-06')]],
        },
        {
            line: [[moment('2020-01-01'), moment('2020-01-05')]],
            restrict: [moment('2020-01-02'), moment('2020-01-03')],
            restrictType: 'out',
            expected: [
                [moment('2020-01-01'), moment('2020-01-02')],
                [moment('2020-01-03'), moment('2020-01-05')]
            ],
        },
        {
            line: [[moment('2020-01-01'), moment('2020-01-05')]],
            restrict: [moment('2020-01-02'), moment('2020-01-08')],
            restrictType: 'out',
            expected: [[moment('2020-01-01'), moment('2020-01-02')]],
        },
        {
            line: [[moment('2020-01-02'), moment('2020-01-10')]],
            restrict: [moment('2020-01-02'), moment('2020-01-08')],
            restrictType: 'out',
            expected: [[moment('2020-01-08'), moment('2020-01-10')]],
        },
        {
            line: [moment('2020-01-08'), moment('2020-01-10')],
            restrict: [moment('2020-01-02'), moment('2020-01-08')],
            restrictType: 'out',
            expected: [moment('2020-01-08'), moment('2020-01-10')],
        },
        {
            line: [[moment('2020-01-04 11:00'), moment('2020-01-04 22:00')]],
            restrict: [moment('2020-01-07'), moment('2020-01-08')],
            restrictType: 'out',
            expected: [[moment('2020-01-04 11:00'), moment('2020-01-04 22:00')]],
        },
    ])('%s', (c: any) => {
        const actual = filterByByRange(c.line, c.restrict, c.restrictType)

        expect(formatIntervals(actual)).toStrictEqual(formatIntervals(c.expected))
    });
});


describe('integration', () => {
    test.each([
        // [
        //     'с 4 января 2020 до 24 декабря 2020: пн-вт: 11:00-20:00, ср: 11:00-21.00, чт-вс: 11:00-22:00',
        //     [
        //         [ '2020-Jan-04 11:00',  '2020-Jan-04 22:00' ],
        //         [ '2020-Jan-06 11:00',  '2020-Jan-06 20:00' ],
        //         [ '2020-Jan-07 11:00',  '2020-Jan-07 20:00' ],
        //         [ '2020-Jan-08 11:00',  '2020-Jan-08 21:00' ],
        //         [ '2020-Jan-09 11:00',  '2020-Jan-09 22:00' ],
        //         [ '2020-Jan-10 11:00',  '2020-Jan-10 22:00' ]
        //     ]
        // ],
        // [
        //     'с 4 января 2020 до 24 декабря 2020: 11:00-22:00',
        //     [
        //         [ '2020-Jan-04 11:00', '2020-Jan-04 22:00' ],
        //         [ '2020-Jan-05 11:00', '2020-Jan-05 22:00' ],
        //         [ '2020-Jan-06 11:00', '2020-Jan-06 22:00' ],
        //         [ '2020-Jan-07 11:00', '2020-Jan-07 22:00' ],
        //         [ '2020-Jan-08 11:00', '2020-Jan-08 22:00' ],
        //         [ '2020-Jan-09 11:00', '2020-Jan-09 22:00' ],
        //         [ '2020-Jan-10 11:00', '2020-Jan-10 22:00' ]
        //     ]
        // ],
        // [
        //     'с 4 января 2020 до 8 января 2020: 11:00-22:00; 5 января 2020: 15:00',
        //     [
        //         ['2020-Jan-04 11:00', '2020-Jan-04 22:00'],
        //         '2020-Jan-05 15:00',
        //         ['2020-Jan-06 11:00', '2020-Jan-06 22:00'],
        //         ['2020-Jan-07 11:00', '2020-Jan-07 22:00'],
        //         ['2020-Jan-08 11:00', '2020-Jan-08 22:00']
        //     ]
        // ],
        // [
        //     'пн: 10:00-15:00',
        //     [
        //         [
        //             '2020-Jan-06 10:00',
        //             '2020-Jan-06 15:00'
        //         ]
        //     ]
        // ],
        [
            'ср: 00:00-15:00',
            [
                [
                    '2020-Jan-01 01:00',
                    '2020-Jan-01 15:00'
                ]
            ]
        ]
    ])('%s', (text, expected: any) => {
        const timetable = parseTimetable(text)
        const intervals = predictIntervals(moment('2020-01-01 01:00:00'), timetable.value)

        const formatIntervals = intervals.map(i =>
            mapInterval(i, (ms) => ms.format('YYYY-MMM-DD HH:mm'))
        )

        expect(formatIntervals).toStrictEqual(expected)
    });
});