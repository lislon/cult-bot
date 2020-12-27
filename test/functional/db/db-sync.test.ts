import { db, dbCfg } from '../../../src/database/db'
import { cleanDb, expectedTitlesStrict, getMockEvent, syncEventsDb4Test } from './db-test-utils'
import { date, mkInterval } from '../../lib/timetable/test-utils'
import { mskMoment } from '../../../src/util/moment-msk'
import { SyncDiff } from '../../../src/database/db-sync-repository'

beforeAll(() => dbCfg.connectionString.includes('test') || process.exit(666))
afterAll(db.$pool.end);

type ExpectedSyncResults = {
    created: string[]
    notChanged: string[]
    updated: string[]
    deleted: string[]
    recovered: string[]
}

function expectSyncResult(syncResults: SyncDiff, expected: ExpectedSyncResults) {
    const actual: ExpectedSyncResults = {
        created: syncResults.insertedEvents.map(e => e.primaryData.title),
        notChanged: syncResults.notChangedEvents.map(e => e.primaryData.title),
        updated: syncResults.updatedEvents.map(e => e.primaryData.title),
        deleted: syncResults.deletedEvents.map(e => e.title),
        recovered: syncResults.recoveredEvents.map(e => e.primaryData.title),
    }
    expect(actual).toStrictEqual(expected)
}

describe('db sync test', () => {

    const eventTime = [mskMoment('2020-01-01 12:00'), mskMoment('2020-01-03 15:00')]
    const eventInterval = mkInterval('[2020-01-01 15:00, 2025-01-03 15:00)')

    beforeEach(cleanDb)


    test('sync should save intervals', async () => {
            await syncEventsDb4Test([getMockEvent({
                eventTime: [
                    [date('2020-01-01 12:00'), date('2020-01-01 18:00')],
                    date('2020-01-02 15:00')
                ]
            })
            ])

            const rows = await db.many(`
                SELECT
                    (lower(cbe.entrance) at time zone 'MSK' || '') as lower,
                    (upper(cbe.entrance) at time zone 'MSK' || '') as upper
                FROM cb_events cb
                LEFT JOIN cb_events_entrance_times cbe on (cbe.event_id = cb.id)
                WHERE cb.deleted_at IS NULL
                ORDER BY lower(cbe.entrance) ASC
                `)
            expect(rows).toEqual([
                {lower: '2020-01-01 12:00:00', upper: '2020-01-01 18:00:00'},
                {lower: '2020-01-02 15:00:00', upper: '2020-01-02 15:00:00'}
            ])
        }, 100000
    )


    test('sync should save tags', async () => {
            await syncEventsDb4Test([
                getMockEvent({tag_level_1: ['#A', '#B'], category: 'theaters'}),
                getMockEvent({tag_level_1: ['#A'], category: 'concerts'})
            ])
            const row = await db.one(`
            select SUM(array_length(tag_level_1, 1)) AS count
            from cb_events cb
            WHERE cb.deleted_at IS NULL
            `)
            expect(+row.count).toEqual(3)
        }, 100000
    )

    test('md5 checksum should work ok', async () => {
        const stressTestEventA = 'Uѡ㵀Ίא粭뒘񓒳𤿉1Gߪ:xŝ<"$󍒉뚅󎦧㰙͢󠀟蘻񪽒⃘碫񴦌ωŇ\\ля\nКакаяСтрока'
        const sync1 = await syncEventsDb4Test([
            getMockEvent({
                title: stressTestEventA,
                address: 'a b"\'!@#$%^&*',
                tag_level_1: ['#A', '{uuM\\T!>s;!G)6#ojbTR'],
                category: 'theaters',
                eventTime
            }),
            getMockEvent({title: 'B', address: '"c"', tag_level_1: ['#A'], category: 'concerts', eventTime})
        ])

        const sync2 = await syncEventsDb4Test([
            getMockEvent({
                title: stressTestEventA,
                address: 'a b"\'!@#$%^&*',
                tag_level_1: ['#A', '{uuM\\T!>s;!G)6#ojbTR'],
                category: 'theaters',
                eventTime
            }),
            getMockEvent({title: 'B', address: '"c"', tag_level_1: ['#A'], category: 'concerts', eventTime})
        ])

        expectSyncResult(sync1, {
            created: [stressTestEventA, 'B'],
            updated: [],
            notChanged: [],
            deleted: [],
            recovered: [],
        })
        expectSyncResult(sync2, {
            created: [],
            updated: [],
            notChanged: [stressTestEventA, 'B'],
            deleted: [],
            recovered: [],
        })

        expectedTitlesStrict([stressTestEventA], await db.repoAdmin.findAllChangedEventsByCat('theaters', eventInterval))


    }, 100000)

    test('3 operations', async () => {
        await cleanDb()
        await syncEventsDb4Test([
            getMockEvent({ext_id: 'A', title: 'A', eventTime}),
            getMockEvent({ext_id: 'B', title: 'B', eventTime}),
            getMockEvent({ext_id: 'C', title: 'C', eventTime}),
        ])

        const sync = await syncEventsDb4Test([
            getMockEvent({ext_id: 'A', title: 'A', eventTime}),
            getMockEvent({ext_id: 'B', title: 'B1', eventTime}),
            getMockEvent({ext_id: 'D', title: 'D', eventTime}),
        ])
        expectSyncResult(sync, {
            created: ['D'],
            updated: ['B1'],
            notChanged: ['A'],
            deleted: ['C'],
            recovered: [],
        })
        expectedTitlesStrict(['A', 'B1', 'D'], await db.repoAdmin.findAllChangedEventsByCat('theaters', eventInterval))
    }, 100000)

    test('recovering works', async () => {
        await cleanDb()
        await syncEventsDb4Test([
            getMockEvent({ext_id: 'A', title: 'A', eventTime}),
            getMockEvent({ext_id: 'B', title: 'B', eventTime}),
            getMockEvent({ext_id: 'C', title: 'C', eventTime}),
        ])

        await syncEventsDb4Test([
            getMockEvent({ext_id: 'A', title: 'A', eventTime}),
            getMockEvent({ext_id: 'C', title: 'C', eventTime}),
        ])

        const sync = await syncEventsDb4Test([
            getMockEvent({ext_id: 'A', title: 'A1', eventTime}),
            getMockEvent({ext_id: 'B', title: 'B1', eventTime}),
            getMockEvent({ext_id: 'C', title: 'C', eventTime}),
        ])

        expectSyncResult(sync, {
            created: [],
            updated: ['A1'],
            notChanged: ['C'],
            deleted: [],
            recovered: ['B1'],
        })
        expectedTitlesStrict(['A1', 'B1', 'C'], await db.repoAdmin.findAllChangedEventsByCat('theaters', eventInterval))
    }, 100000)

    test('tags will not be corrupted', async () => {
        await cleanDb()
        await syncEventsDb4Test([
            getMockEvent({ext_id: 'A', title: 'A', eventTime, tag_level_1: ['#lisa']}),
        ])
        const syncDiff = await syncEventsDb4Test([
            getMockEvent({ext_id: 'A', title: 'A', eventTime, tag_level_1: ['#lisa']}),
        ])
        expect(0).toEqual(syncDiff.updatedEvents.length)
    })

    test('deleted items will revive', async () => {

    })
})
