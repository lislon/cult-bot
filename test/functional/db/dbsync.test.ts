import { db, dbCfg } from '../../../src/db'
import { mskMoment } from '../../../src/util/moment-msk'
import { cleanDb, getMockEvent, syncDatabase4Test } from './db-test-utils'

beforeAll(() => dbCfg.connectionString.includes('test') || process.exit(666))
afterAll(db.$pool.end);

describe('db sync test', () => {

    beforeEach(async () => {
        await db.query('BEGIN')
        await cleanDb()
    })

    afterEach(async () => {
        await db.query('COMMIT')
    })

    test('sync should save intervals', async () => {
            await syncDatabase4Test([getMockEvent({
                eventTime: [
                    [mskMoment('2020-01-01 12:00'), mskMoment('2020-01-01 18:00')],
                    mskMoment('2020-01-02 15:00')
                ]
            })
            ])
            const row = await db.one('select count(1) AS count from cb_events_entrance_times')
            expect(+row.count).toEqual(2)
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