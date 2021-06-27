import { datesToTimetable } from '../../src/lib/dates-to-timetable'
import { parse, parseISO } from 'date-fns'

function date(s: string): Date {
    if (s.length === 'yyyy-MM-dd'.length) {
        return parseISO(s)
    }
    return parse(s, 'yyyy-MM-dd HH:mm', new Date())
}

// январь 2020
// пн	вт	ср	чт	пт	сб	вс
//          1	2	3	4	5
// 6	7	8	9	10	11	12
// 13	14	15	16	17	18	19
// 20	21	22	23	24	25	26
// 27	28	29	30	31

describe('dates to timetable', () => {

    test('single date', () => {
        const timetable = datesToTimetable([date('2020-01-01 15:00')])
        expect(timetable).toEqual('01 января: 15:00')
    })

    test('two dates', () => {
        const timetable = datesToTimetable([date('2020-01-01 15:00'), date('2020-01-02 15:00')])
        expect(timetable).toEqual([
            '01-02 января: 15:00'
        ].join('\n'))
    })

    test('three dates', () => {
        const timetable = datesToTimetable([
            date('2020-01-01 15:00'),
            date('2020-01-02 15:00'),
            date('2020-01-03 15:00')
        ])
        expect(timetable).toEqual([
            '01-03 января: 15:00',
        ].join('\n'))
    })

    test('san-sat same time', () => {
        const timetable = datesToTimetable([
            date('2020-01-04 15:00'),
            date('2020-01-05 15:00'),
            date('2020-01-11 15:00'),
            date('2020-01-12 15:00'),
            date('2020-01-18 15:00'),
            date('2020-01-19 15:00'),
        ])
        expect(timetable).toEqual([
            '04-19 января: сб–вс: 15:00'
        ].join('\n'))
    })

    test('san-sat diff time', () => {
        const timetable = datesToTimetable([
            date('2020-01-04 15:00'),
            date('2020-01-05 16:30'),
            date('2020-01-11 15:00'),
            date('2020-01-12 16:30'),
            date('2020-01-18 15:00'),
            date('2020-01-19 16:30'),
        ])
        expect(timetable).toEqual([
            '04-19 января: сб: 15:00, вс: 16:30'
        ].join('\n'))
    })

    test('period of days with constant time', () => {
        const timetable = datesToTimetable([
            date('2020-01-04 15:00'),
            date('2020-01-05 15:00'),
            date('2020-01-06 15:00'),
            date('2020-01-07 15:00'),
            date('2020-01-08 15:00'),
            date('2020-01-09 15:00'),
            date('2020-01-10 15:00'),
        ])
        expect(timetable).toEqual([
            '04-10 января: 15:00'
        ].join('\n'))
    })
})
