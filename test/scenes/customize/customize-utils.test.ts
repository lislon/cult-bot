import { mapUserInputToTimeIntervals } from '../../../src/scenes/customize/customize-utils'
import { interval } from '../../lib/timetable/test-utils'


describe('convert_to_intervals', () => {
     const weekends = interval('[2020-01-01 00:00, 2020-01-03 00:00)')

    test.each([
        ['saturday.12:00-15:00', [interval('[2020-01-01 12:00, 2020-01-01 15:00)')]],
        ['sunday.15:00-02:00', [
            interval('[2020-01-02 00:00, 2020-01-02 02:00)'),
            interval('[2020-01-02 15:00, 2020-01-03 00:00)')
        ]],
    ])('%s', (text: string, expected: Interval[]) => {
        const actual = mapUserInputToTimeIntervals([text], weekends)
        expect(actual).toEqual(expected)
    })
})