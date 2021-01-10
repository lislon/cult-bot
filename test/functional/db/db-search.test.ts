import { cleanDb, expectedTitles, getMockEvent, syncEventsDb4Test } from './db-test-utils'
import { mskMoment } from '../../../src/util/moment-msk'
import { db, dbCfg } from '../../../src/database/db'
import { mkInterval } from '../../lib/timetable/test-utils'

beforeAll(() => dbCfg.connectionString.includes('test') || process.exit(666))
afterAll(db.$pool.end);

describe('Search', () => {

    beforeEach(cleanDb)

    const eventTime = [mskMoment('2020-01-01 12:00'), mskMoment('2020-01-03 15:00')]
    const yearRange = mkInterval('[2020-01-01 00:00, 2021-01-02 00:00)')

    test('search by title works', async () => {
        await syncEventsDb4Test([
                getMockEvent({title: 'event dog 5', eventTime, category: 'movies', rating: 5}),
                getMockEvent({title: 'event cat 5', eventTime, category: 'movies', rating: 5}),
                getMockEvent({title: 'event cat 15', eventTime, category: 'movies', rating: 15})
            ]
        )
        expectedTitles(['event cat 15', 'event cat 5'], await db.repoSearch.searchIds({
            query: 'event cat',
            interval: yearRange,
            limit: 100
        }))
    })

    test('search will show only nearest weekends', async () => {
        const eventSat = [mskMoment('2020-01-04 00:00')]
        const eventSun = [mskMoment('2020-01-05 23:00')]
        const eventNextSat = [mskMoment('2020-01-11 12:00')]

        await syncEventsDb4Test([
                getMockEvent({title: 'event sat', eventTime: eventSat, category: 'movies', rating: 5}),
                getMockEvent({title: 'event sun', eventTime: eventSun, category: 'movies', rating: 5}),
                getMockEvent({title: 'event next sat', eventTime: eventNextSat, category: 'movies', rating: 15})
            ]
        )
        expectedTitles(['event sat', 'event sun'], await db.repoSearch.searchIds({
            query: 'event',
            interval: mkInterval('[2020-01-04 00:00, 2020-01-06 00:00)')
        }))
    })

    test('search by ext_id works', async () => {
        await syncEventsDb4Test([
                getMockEvent({ext_id: 'ABC', title: 'event dog 5', eventTime, category: 'movies', rating: 5}),
            ]
        )
        expectedTitles(['event dog 5'], await db.repoSearch.searchIds({
            query: 'ABC',
            interval: yearRange,
            limit: 100,
            allowSearchById: true
        }))
    })

})
