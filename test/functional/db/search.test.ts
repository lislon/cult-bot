import { expectedTitles, getMockEvent, syncDatabase4Test } from './db-test-utils'
import { mskMoment } from '../../../src/util/moment-msk'
import { db, dbCfg } from '../../../src/db'
import { interval } from '../../lib/timetable/test-utils'

beforeAll(() => dbCfg.connectionString.includes('test') || process.exit(666))
afterAll(db.$pool.end);

describe('Search', () => {

    const eventTime = [mskMoment('2020-01-01 12:00'), mskMoment('2020-01-03 15:00')]
    const yearRange = interval('[2020-01-01 00:00, 2021-01-02 00:00)')

    test('search by title works', async () => {
        await syncDatabase4Test([
                getMockEvent({title: 'event dog 5', eventTime, category: 'movies', rating: 5}),
                getMockEvent({title: 'event cat 5', eventTime, category: 'movies', rating: 5}),
                getMockEvent({title: 'event cat 15', eventTime, category: 'movies', rating: 15})
            ]
        )
        expectedTitles(['event cat 15', 'event cat 5'], await db.repoSearch.search({
            query: 'event cat',
            interval: yearRange,
            limit: 100
        }))
    })

})