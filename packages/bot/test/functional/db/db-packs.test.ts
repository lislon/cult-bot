import { cleanDb, expectedIds, expectedPacksTitle, getMockEvent, getMockPack, syncEventsDb4Test } from './db-test-utils'
import { db, dbCfg } from '../../../src/database/db'
import { mskMoment } from '../../../src/util/moment-msk'
import { mkInterval } from '../../util/timetable-util'

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
        await db.repoPacks.syncDatabase([getMockPack({extId: 'A'})])
    })

    test('packs will be filtered by date', async () => {
        const [aId, bId, cId] = await syncEventsDb4Test([
            getMockEvent({extId: 'A', eventTime}),
            getMockEvent({extId: 'B', eventTime}),
            getMockEvent({extId: 'C', eventTime: eventTimeOutRange}),
        ])

        await db.repoPacks.syncDatabase([
            getMockPack({extId: 'A pack', eventIds: [aId, bId]}),
            getMockPack({extId: 'B back', eventIds: [aId, cId]}),
        ])
        const list = await db.repoPacks.listPacks({interval: yearRange})
        expectedPacksTitle(['A pack'], list)
    })

    test('packs with single event will not be shown', async () => {
        const [aId, bId] = await syncEventsDb4Test([
            getMockEvent({extId: 'A', eventTime}),
        ])

        await db.repoPacks.syncDatabase([
            getMockPack({extId: 'A pack', eventIds: [aId]})
        ])
        const list = await db.repoPacks.listPacks({interval: yearRange})
        expectedPacksTitle([], list)
    })


    test('events in packs will be sorted', async () => {

        const day1 = [mskMoment('2020-01-01 12:00')]
        const day2 = [mskMoment('2020-01-02 12:00')]
        const day3 = [mskMoment('2020-01-03 12:00')]

        const [A, B, C, D, E] = await syncEventsDb4Test([
            getMockEvent({extId: 'B', eventTime: day2}),
            getMockEvent({extId: 'E', eventTime: day2, anytime: true, rating: 10}),
            getMockEvent({extId: 'D', eventTime: day2, anytime: true, rating: 5}),
            getMockEvent({extId: 'A', eventTime: day1}),
            getMockEvent({extId: 'C', eventTime: day3}),
        ])

        await db.repoPacks.syncDatabase([
            getMockPack({extId: 'A pack', eventIds: [A, B, C, D, E]}),
        ])

        const events = await db.repoPacks.listPacks({ interval: yearRange })
        expectedIds([A, B, C, D, E], events[0].events.map(e => e.id))
    })


})