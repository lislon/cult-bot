import { db } from '../../../src/db'
import { mskMoment } from '../../../src/util/moment-msk'
import { freshDb, getMockEvent, initializeDbTests } from './db-test-utils'
import { syncDatabase } from '../../../src/db/sync'

initializeDbTests()

describe('db sync test', () => {

    freshDb()

    test('sync should save intervals', async () => {
            await syncDatabase([getMockEvent({
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
            await syncDatabase([
                getMockEvent({ tag_level_1: ['#A', '#B'], category: 'theaters'}),
                getMockEvent({ tag_level_1: ['#A'], category: 'concerts'})
            ])
            const row = await db.one(`select SUM(array_length(tag_level_1, 1)) AS count from cb_events ce`)
            expect(+row.count).toEqual(3)
        }, 100000
    )

})