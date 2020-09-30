import { mskMoment } from '../../../src/util/moment-msk'
import { mapUserInputToTimeIntervals } from '../../../src/scenes/customize/customize-utils'

describe('convert_to_intervals', () => {
     const weekends = [
         mskMoment('2020-01-01 00:00:00'),
         mskMoment('2020-01-02 23:59:00')
     ]

    test.each([
        ['saturday.12:00-15:00', [
            ['2020-01-01 12:00', '2020-01-01 15:00']]
        ],
        ['sunday.15:00-02:00', [
            ['2020-01-02 00:00', '2020-01-02 02:00'],
            ['2020-01-02 15:00', '2020-01-03 00:00']
        ]],
    ])('%s', (text: string, expected: string[][]) => {
        const ranges = mapUserInputToTimeIntervals([text], weekends)
        const actual = ranges.map(r => r.map(t => t.tz('Europe/Moscow').format('YYYY-MM-DD HH:mm')))
        expect(actual).toEqual(expected)
    })
})