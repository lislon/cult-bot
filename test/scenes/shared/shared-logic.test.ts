import { getNextWeekEndRange } from '../../../src/scenes/shared/shared-logic'
import { date, mkInterval } from '../../lib/timetable/test-utils'


// январь 2020
// пн	вт	ср	чт	пт	сб	вс
//          1	2	3	4	5
// 6	7	8	9	10	11	12
// 13	14	15	16	17	18	19
// 20	21	22	23	24	25	26
// 27	28	29	30	31

describe('getNextWeekEndRange', () => {

    test.each([
        [(date('2020-01-01 00:00')), mkInterval('[2020-01-04 00:00, 2020-01-06 00:00)')],
        [(date('2020-01-05 15:00')), mkInterval('[2020-01-05 15:00, 2020-01-06 00:00)')],
        [(date('2020-01-06 00:00')), mkInterval('[2020-01-11 00:00, 2020-01-13 00:00)')],
    ])('Now is %s', (now: Date, expected: Interval) => {
        expect(getNextWeekEndRange(now)).toEqual(expected)
    })
})