import { parseTimetable } from '../../../src/lib/timetable/parser'
import { date } from './test-utils'
import { fail } from 'parsimmon'

describe('parser', () => {
    test.each([
        ['с 1 января 2020 до 24 декабря 2020: пн-вт: 11:00-20:00, ср: 11:00-21.00, чт-вс: 11:00-20:00',
            {
                'dateRangesTimetable': [
                    {
                        'dateRange': [
                            '2020-01-01',
                            '2020-12-24'
                        ],
                        'weekTimes': [
                            {
                                'weekdays': [
                                    1,
                                    2
                                ],
                                'times': [
                                    [
                                        '11:00',
                                        '20:00'
                                    ]
                                ]
                            },
                            {
                                'weekdays': [
                                    3
                                ],
                                'times': [
                                    [
                                        '11:00',
                                        '21:00'
                                    ]
                                ]
                            },
                            {
                                'weekdays': [
                                    4,
                                    5,
                                    6,
                                    7
                                ],
                                'times': [
                                    [
                                        '11:00',
                                        '20:00'
                                    ]
                                ]
                            }
                        ]
                    }
                ]
            }
        ],
        ['в любое время',
            {
                anytime: true
            }
        ],
        ['с 1 января 2020 до 1 января 2020: в любое время',
            {
                'datesExact': [
                    {
                        'dateRange': [
                            '2020-01-01',
                            '2020-01-01'
                        ],
                        'times': [
                            [
                                '00:00',
                                '24:00'
                            ]
                        ]
                    }
                ],
            }
        ],
        ['1 января: 10:10;2 января: 10:00',
            {
                'datesExact': [
                    {
                        'dateRange': [
                            '2020-01-01'
                        ],
                        'times': [
                            '10:10'
                        ]
                    },
                    {
                        'dateRange': [
                            '2020-01-02'
                        ],
                        'times': [
                            '10:00'
                        ]
                    }
                ],
                'weekTimes': []
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
                            '2020-10-17'
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
                            '2020-10-18'
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
        ]
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
    });

    test('year rollolver', () => {
        const actual = parseTimetable('1 января: 12:00', date('2020-01-02'))
        if (actual.status === true) {
            expect(actual.value.datesExact).toStrictEqual([{'dateRange': ['2021-01-01'], 'times': ['12:00']}])
        } else {
            fail('Not success')
        }
    })
});