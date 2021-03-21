import { mskMoment } from '../../src/util/moment-msk'
import { autoAppendLastChanceTags, LAST_CHANCE_PREDICT_CONFIG } from '../../src/core/last-chance'
import { parseAndPredictTimetable } from '../../src/lib/timetable/timetable-utils'
import { TagLevel2 } from '../../src/interfaces/app-interfaces'
import { EventCategory } from '@culthub/interfaces'


describe('last chance', () => {

    const now = mskMoment('2020-01-01 12:00')

    function expectLastChanceTags(expected: boolean, category: EventCategory, timetable: string, tagLevel2: TagLevel2[]) {
        const {predictedIntervals, parsedTimetable} = parseAndPredictTimetable(timetable, now, LAST_CHANCE_PREDICT_CONFIG)

        const newTags = autoAppendLastChanceTags({
            predictedIntervals, parsedTimetable, tagLevel2, now, category
        })

        expect(newTags.includes('#_последнийшанс')).toBe(expected)
    }

    test('Temporary Exhibition 2 weeks', () => {
        expectLastChanceTags(true, 'exhibitions', '1 января - 15 января: 12:00', [])
    })

    test('Temporary Exhibition 2 weeks + 1 min', () => {
        expectLastChanceTags(false, 'exhibitions', '1 января - 15 января: 12:01', [])
    })

    test('Other events 1 week', () => {
        expectLastChanceTags(true, 'walks', '1 января - 8 января: 12:00', [])
    })

    test('Other events 1 week + 1 min', () => {
        expectLastChanceTags(false, 'walks', '1 января - 8 января: 12:01', [])
    })

    test('Regular timetable or anytime', () => {
        expectLastChanceTags(false, 'theaters', 'пн-вс: 12:00', [])
        expectLastChanceTags(false, 'theaters', 'в любое время', [])
    })

    test('explicit', () => {
        expectLastChanceTags(true, 'theaters', 'пн-вс: 12:00', ['#последнийшанс'])
    })
})