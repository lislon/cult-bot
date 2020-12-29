import {
    cleanDb,
    expectedPacksTitle,
    expectedTitles,
    getMockEvent,
    getMockPack,
    syncEventsDb4Test
} from './db-test-utils'
import { db, dbCfg } from '../../../src/database/db'
import { mkInterval } from '../../lib/timetable/test-utils'
import { mskMoment } from '../../../src/util/moment-msk'

beforeAll(() => dbCfg.connectionString.includes('test') || process.exit(666))
afterAll(db.$pool.end);

describe('Packs', () => {
    const eventTime = [mskMoment('2020-01-01 12:00'), mskMoment('2020-01-03 15:00')]
    const eventTimeOutRange = [mskMoment('2022-01-01 12:00'), mskMoment('2022-01-03 15:00')]
    const yearRange = mkInterval('[2020-01-01 00:00, 2021-01-02 00:00)')

    beforeEach(async () => {
        await cleanDb()
    })

    test('sync packs', async () => {
        await db.repoPacks.sync([getMockPack({title: 'A'})])
    })

    test('packs will be filtered by date', async () => {
        const [aId, bId] = await syncEventsDb4Test([
            getMockEvent({title: 'A', eventTime}),
            getMockEvent({title: 'B', eventTime: eventTimeOutRange}),
        ])

        await db.repoPacks.sync([
            getMockPack({ title: 'A pack', eventIds: [ aId ] }),
            getMockPack({ title: 'B back', eventIds: [ bId ] })
        ])
        const list = await db.repoPacks.listPacks({interval: yearRange})
        expectedPacksTitle(['A pack'], list)
    })

    test('events in packs will be sorted', async () => {

        const day1 = [mskMoment('2020-01-01 12:00')]
        const day2 = [mskMoment('2020-01-02 12:00')]
        const day3 = [mskMoment('2020-01-03 12:00')]

        const eventIds = await syncEventsDb4Test([
            getMockEvent({title: 'B', eventTime: day2}),
            getMockEvent({title: 'E', eventTime: day2, anytime: true, rating: 10}),
            getMockEvent({title: 'D', eventTime: day2, anytime: true, rating: 5}),
            getMockEvent({title: 'A', eventTime: day1}),
            getMockEvent({title: 'C', eventTime: day3}),
        ])

        await db.repoPacks.sync([
            getMockPack({ title: 'A pack', eventIds }),
        ])

        const events = await db.repoPacks.listPacks({ interval: yearRange })
        expectedTitles(['A', 'B', 'C', 'D', 'E'], events[0].events)
    })

    test('find by title works', async () => {
        const result = await db.repoPacks.findPackByTitle('not existing')
        expect(result).toBeUndefined()
    })



})