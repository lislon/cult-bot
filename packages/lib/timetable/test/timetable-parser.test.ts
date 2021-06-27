import { date } from './test-utils'
import { EventTimetable, parseTimetable } from '../src'

const DATE_2020_JAN_1 = date('2020-01-01')
describe('parser', () => {
    test.each([
        ['ежедневно: 12:00',
            {
                'weekTimes': [
                    {
                        'times': [
                            '12:00'
                        ],
                        'weekdays': [1, 2, 3, 4, 5, 6, 7]
                    }
                ]
            }
        ],
        ['пн-пт: с 12 до 18',
            {
                'weekTimes': [
                    {
                        'times': [
                            [
                                '12:00',
                                '18:00'
                            ]
                        ],
                        'weekdays': [
                            1,
                            2,
                            3,
                            4,
                            5
                        ]
                    }
                ]
            }
        ],
        ['пн, пт: с 12 до 18; вт: с 10 до 22:30',
            {
                'weekTimes': [
                    {
                        'times': [
                            [
                                '12:00',
                                '18:00'
                            ]
                        ],
                        'weekdays': [
                            1,
                            5
                        ]
                    },
                    {
                        'times': [
                            [
                                '10:00',
                                '22:30'
                            ]
                        ],
                        'weekdays': [
                            2
                        ]
                    }
                ]
            },
        ],
        ['31 ноября 2020: с 12 до 18', ['Дата "2020-11-31" не может существовать']],
        ['вс-пн: с 12 до 18',
            {
                'weekTimes': [
                    {
                        'times': [
                            [
                                '12:00',
                                '18:00'
                            ]
                        ],
                        'weekdays': [
                            1,
                            7
                        ]
                    }
                ]
            }
        ],
        ['1 января 2020: 01:01;',
            {
                'datesExact': [
                    {
                        'date': '2020-01-01',
                        'times': [
                            '01:01'
                        ]
                    }
                ],
            }],
        ['17 октября: 10:10 - 19:40\n' +
        '18 октября: 10:00 - 19:40',
            {
                'datesExact': [
                    {
                        'date': '2019-10-17',
                        'times': [
                            [
                                '10:10',
                                '19:40'
                            ]
                        ]
                    },
                    {
                        'date': '2019-10-18',
                        'times': [
                            [
                                '10:00',
                                '19:40'
                            ]
                        ]
                    }
                ]
            }
        ],
        ['16 июля — 01 декабря 2020: 12:00–20:00',
            {
                'dateRangesTimetable': [
                    {
                        'dateRange': [
                            '2020-07-16',
                            '2020-12-01'
                        ],
                        'times': [
                            [
                                '12:00',
                                '20:00'
                            ]
                        ],
                        'weekTimes': []
                    }
                ],
            }
        ],
        ['16 декабря 2020 — 01 декабря 2020: 12:00–20:00',
            [`Дата '2020-12-16' должна быть меньше, чем '2020-12-01'`]
        ],
        ['23января: 19:00',
            ['После строки "23" я ожидала:', ' - Интервал дат', ' - пробелы', 'И текст "января: 19:00" не подходит к вышеперечисленному']
        ],
    ])('%s', (text: string, expected: any) => {
        if (expected) {
            expected.dateRangesTimetable = expected.dateRangesTimetable || []
            expected.anytime = expected.anytime || false
            expected.datesExact = expected.datesExact || []
            expected.weekTimes = expected.weekTimes || []
        }
        const actual = parseTimetable(text, DATE_2020_JAN_1)

        let expectedX, actualX

        if (actual.status === true) {
            actualX = actual.value
            expectedX = expected
        } else {
            // JSON.stringify to avoid bug: 'Received: serializes to the same string'
            actualX = JSON.stringify(actual.errors)
            expectedX = JSON.stringify(expected)
        }
        expect(actualX).toStrictEqual(expectedX)
    })

    test('year rollolver', () => {
        const actual = doParseTimetable('1 января: 12:00', date('2020-07-02'))
        expect(actual.datesExact).toStrictEqual([{'date': '2021-01-01', 'times': ['12:00']}])
    })

    test('single dates with comments', () => {
        const actual = doParseTimetable('06 февраля: 11:30, 14:00 (давай давай)\n07 февраля: 11:30, 14:00', DATE_2020_JAN_1)
        expect(actual.datesExact).toStrictEqual([
            {'date': '2020-02-06', 'times': ['11:30', '14:00'], 'comment': 'давай давай'},
            {'date': '2020-02-07', 'times': ['11:30', '14:00']}]
        )
    })

    test('week dates with comments', () => {
        const actual = doParseTimetable('пн-пт: 12:00 (давай давай)', DATE_2020_JAN_1)
        expect(actual.weekTimes).toStrictEqual([{
                'times': ['12:00'],
                'weekdays': [1, 2, 3, 4, 5],
                'comment': 'давай давай'
            }]
        )
    })

    test('day-day range in single month', () => {
        const actual = doParseTimetable('17-26 января: 00:00', DATE_2020_JAN_1)
        expect(actual.dateRangesTimetable).toStrictEqual([{
                dateRange: ['2020-01-17', '2020-01-26'],
                times: ['00:00'],
                weekTimes: [],
            }]
        )
    })

    test('far distance range', () => {
        const actual = doParseTimetable('15 июня - 15 декабря: 00:00', DATE_2020_JAN_1)
        expect(actual.dateRangesTimetable).toStrictEqual([{
                dateRange: ['2020-06-15', '2020-12-15'],
                times: ['00:00'],
                weekTimes: [],
            }]
        )
    })

    test('english letter c', () => {
        const actual = doParseTimetable('cб: 12:00', DATE_2020_JAN_1)
        expect(actual.weekTimes).toStrictEqual([{
                times: ['12:00'],
                weekdays: [6]
            }]
        )
    })
})

function doParseTimetable(input: string, now: Date): EventTimetable {
    const actual = parseTimetable(input, now)
    if (actual.status === false) {
        throw new Error(`failed to parse timetable: ${actual.errors.join('\n')}`)
    }
    return actual.value
}