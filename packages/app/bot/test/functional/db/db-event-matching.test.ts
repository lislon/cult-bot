import { db, dbCfg } from '../../../src/database/db'
import { getMockEvent, syncEventsDb4Test } from './db-test-utils'
import { date } from '../../util/timetable-util'

beforeAll(() => dbCfg.connectionString.includes('test') || process.exit(666))
afterAll(db.$pool.end)

describe('Event Matching', () => {

    beforeEach(async () => await db.none('DELETE FROM cb_events'))

    test('Event can be matched', async () => {
        const eventTime = [[date('2020-01-01 12:00'), date('2020-01-03 15:00')]]
        await syncEventsDb4Test([
            getMockEvent({
                extId: 'A',
                title: 'Event One',
                category: 'theaters',
                eventTime,
                tag_level_1: ['#A', '#B', '#C']
            }),
            getMockEvent({
                extId: 'B',
                title: 'Event Two',
                category: 'theaters',
                eventTime,
                tag_level_1: ['#A', '#B', '#C']
            }),
        ])

        // const extIds = await db.repoEventsMatching.findMatchingEvents({title: 'event one', category: 'theaters'})
        // expect(extIds).toStrictEqual(['A'])
    })
})
