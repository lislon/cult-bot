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

    const day1 = [mskMoment('2020-01-01 12:00')]
    const day2 = [mskMoment('2020-01-02 12:00')]
    const day3 = [mskMoment('2020-01-03 12:00')]


    beforeEach(async () => {
        await cleanDb()
    })

    test('sync packs', async () => {
        await db.repoPacks.syncDatabase([getMockPack({extId: 'A'})])
    })

    test('packs will be filtered by date when only 1 active will left', async () => {
        const [aId, bId, cId] = await syncEventsDb4Test([
            getMockEvent({extId: 'A', eventTime}),
            getMockEvent({extId: 'B', eventTime}),
            getMockEvent({extId: 'C', eventTime: eventTimeOutRange}),
        ])

        await db.repoPacks.syncDatabase([
            getMockPack({extId: 'G1', eventIds: [aId, bId], hideIfLessThen: 2}),
            getMockPack({extId: 'B back', eventIds: [aId, cId], hideIfLessThen: 2}),
        ])
        const list = await db.repoPacks.listPacks({interval: yearRange})
        expectedPacksTitle(['G1'], list)
    })

    test('packs with single event will be shown if hide_if_less_then =1', async () => {
        const [aId] = await syncEventsDb4Test([
            getMockEvent({extId: 'A', eventTime}),
        ])

        await db.repoPacks.syncDatabase([
            getMockPack({extId: 'G1', eventIds: [aId], hideIfLessThen: 1})
        ])
        const list = await db.repoPacks.listPacks({interval: yearRange})
        expectedPacksTitle(['G1'], list)
    })

    test('packs with 5 events will not be shown if hide_if_less_then = 6', async () => {
        const [aId] = await syncEventsDb4Test([
            getMockEvent({extId: 'A', eventTime}),
        ])

        await db.repoPacks.syncDatabase([
            getMockPack({extId: 'G1', eventIds: [aId], hideIfLessThen: 6})
        ])
        const list = await db.repoPacks.listPacks({interval: yearRange})
        expectedPacksTitle([], list)
    })


    test('events in packs will be sorted', async () => {

        const [A, B, C, D, E] = await syncEventsDb4Test([
            getMockEvent({extId: 'B', eventTime: day2}),
            getMockEvent({extId: 'E', eventTime: day2, anytime: true, rating: 10}),
            getMockEvent({extId: 'D', eventTime: day2, anytime: true, rating: 5}),
            getMockEvent({extId: 'A', eventTime: day1}),
            getMockEvent({extId: 'C', eventTime: day3}),
        ])

        await db.repoPacks.syncDatabase([
            getMockPack({extId: 'G1', eventIds: [A, B, C, D, E]}),
        ])

        const events = await db.repoPacks.listPacks({ interval: yearRange })
        expectedIds([A, B, C, D, E], events[0].events.map(e => e.id))
    })

    describe('Single pack', () => {

        test('Should show sorted events', async () => {

            const [aId, bId, cId] = await syncEventsDb4Test([
                getMockEvent({extId: 'A', eventTime: day2}),
                getMockEvent({extId: 'B', eventTime: day1}),
                getMockEvent({extId: 'C', eventTime: eventTimeOutRange}),
            ])

            const packSync = await db.repoPacks.syncDatabase([
                getMockPack({extId: 'G1', eventIds: [aId, bId, cId], hideIfLessThen: 2}),
            ])
            const packId = packSync.inserted[0].primaryData.id
            const eventIds = await db.repoPacks.getEventIdsByPackId({interval: yearRange, packId})
            expect(eventIds).toStrictEqual([bId, aId])
        })

        test('packs with 2 events should be hidden when hideIfLessThen = 3', async () => {
            const [aId, bId, cId] = await syncEventsDb4Test([
                getMockEvent({extId: 'A', eventTime: day2}),
                getMockEvent({extId: 'B', eventTime: day1}),
                getMockEvent({extId: 'C', eventTime: eventTimeOutRange}),
            ])

            const packSync = await db.repoPacks.syncDatabase([
                getMockPack({extId: 'G1', eventIds: [aId, bId, cId], hideIfLessThen: 3}),
            ])
            const packId = packSync.inserted[0].primaryData.id
            const eventIds = await db.repoPacks.getEventIdsByPackId({interval: yearRange, packId})
            expect(eventIds).toStrictEqual([])
        })

        test('Can find active pack by extId', async () => {
            const [aId, bId, cId] = await syncEventsDb4Test([
                getMockEvent({extId: 'A', eventTime: day2}),
                getMockEvent({extId: 'B', eventTime: day1}),
                getMockEvent({extId: 'C', eventTime: eventTimeOutRange}),
            ])

            const packSync = await db.repoPacks.syncDatabase([
                getMockPack({extId: 'G1', eventIds: [aId, bId, cId], hideIfLessThen: 3}),
            ])
            const foundId = await db.repoPacks.getActivePackInfoByExtId({interval: yearRange, extId: 'G1'})
            expect(foundId).toStrictEqual({
                id: packSync.inserted[0].primaryData.id,
                title: 'G1'
            })
        })

        test('Will return null if no active pack exists by extId', async () => {
            const [aId, bId, cId] = await syncEventsDb4Test([
                getMockEvent({extId: 'C', eventTime: eventTimeOutRange}),
            ])

            await db.repoPacks.syncDatabase([
                getMockPack({extId: 'G1', eventIds: [aId, bId, cId], hideIfLessThen: 3}),
            ])
            const foundId = await db.repoPacks.getActivePackInfoByExtId({interval: yearRange, extId: 'G1'})
            expect(foundId).toBeUndefined()
        })

    })


})