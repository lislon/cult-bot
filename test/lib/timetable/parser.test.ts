import { parseTimetable } from '../../../src/lib/timetable/parser'

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
        ['онлайн',
            {
                anytime: true
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
        ['31 ноября 2020: с 12 до 18', undefined],
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
    ])('%s', (text: string, expected: any) => {
        if (expected) {
            expected.dateRangesTimetable = expected.dateRangesTimetable || []
            expected.anytime = expected.anytime || false
            expected.datesExact = expected.datesExact || []
            expected.weekTimes = expected.weekTimes || []
        }
        const actual = parseTimetable(text)
        if (actual.status === true) {
            expect(actual.value).toStrictEqual(expected)
        } else {
            expect(undefined).toStrictEqual(expected)
        }
    });
});