import { parseTimetable } from '../../../src/lib/timetable/parser'
import { date } from './test-utils'
import { fail } from 'parsimmon'

describe('parser', () => {
    test.each([
        ['06 февраля: 11:30, 14:00\n07 февраля: 11:30, 14:00',
            {
                datesExact: [
                    {'dateRange': ['2020-02-06'], 'times': ['11:30', '14:00']},
                    {'dateRange': ['2020-02-07'], 'times': ['11:30', '14:00']}],
            }
        ],
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
        ['пн-пт: 12:00',
            {
                'weekTimes': [
                    {
                        'times': [
                            '12:00'
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
                        'dateRange': [
                            '2020-01-01',
                        ],
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
                        'dateRange': [
                            '2019-10-17'
                        ],
                        'times': [
                            [
                                '10:10',
                                '19:40'
                            ]
                        ]
                    },
                    {
                        'dateRange': [
                            '2019-10-18'
                        ],
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
                        ]
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
        const actual = parseTimetable(text, date('2020-01-01'))
        if (actual.status === true) {
            expect(actual.value).toStrictEqual(expected)
        } else {
            // JSON.stringify to avoid bug: 'Received: serializes to the same string'
            expect(JSON.stringify(actual.errors)).toStrictEqual(JSON.stringify(expected))
        }
    })

    test('year rollolver', () => {
        const actual = parseTimetable('1 января: 12:00', date('2020-07-02'))
        if (actual.status === true) {
            expect(actual.value.datesExact).toStrictEqual([{'dateRange': ['2021-01-01'], 'times': ['12:00']}])
        } else {
            fail('Not success')
        }
    })
})