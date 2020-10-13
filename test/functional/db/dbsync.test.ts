import { db, dbCfg } from '../../../src/db'
import { mskMoment } from '../../../src/util/moment-msk'
import { cleanDb, getMockEvent, syncDatabase4Test } from './db-test-utils'
import { date } from '../../lib/timetable/test-utils'

beforeAll(() => dbCfg.connectionString.includes('test') || process.exit(666))
afterAll(db.$pool.end);

describe('db sync test', () => {

    beforeEach(async () => {
        await cleanDb()
    })


    test('sync should save intervals', async () => {
            await syncDatabase4Test([getMockEvent({
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
                ORDER BY lower(cbe.entrance) ASC
                `)
            expect(rows).toEqual([
                { lower: '2020-01-01 12:00:00', upper: '2020-01-01 18:00:00' },
                { lower: '2020-01-02 15:00:00', upper: '2020-01-02 15:00:00' }
            ])
        }, 100000
    )


    test('sync should save tags', async () => {
            await syncDatabase4Test([
                getMockEvent({ tag_level_1: ['#A', '#B'], category: 'theaters'}),
                getMockEvent({ tag_level_1: ['#A'], category: 'concerts'})
            ])
            const row = await db.one(`select SUM(array_length(tag_level_1, 1)) AS count from cb_events ce`)
            expect(+row.count).toEqual(3)
        }, 100000
    )

})