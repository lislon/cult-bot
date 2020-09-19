import { db } from '../../../src/db'
import { mskMoment } from '../../../src/util/moment-msk'
import { getMockEvent, initializeDbTests } from './db-test-utils'
import { syncDatabase } from '../../../src/db/sync'


initializeDbTests()

describe('db sync test', () => {

    test('sync should save in db', async () => {
            await syncDatabase([getMockEvent([
                [mskMoment('2020-01-01 12:00'), mskMoment('2020-01-01 18:00')],
                [mskMoment('2020-01-02 15:00')]
            ])])
            const row = await db.one('select count(1) AS count from cb_time_intervals')
            expect(+row.count).toEqual(2)
        }, 100000
    )
})