import { cleanDb, getMockEvent, syncEventsDb4Test } from './db-test-utils'
import { db, dbCfg } from '../../../src/database/db'
import { mkInterval } from '../../lib/timetable/test-utils'
import { mskMoment } from '../../../src/util/moment-msk'

beforeAll(() => dbCfg.connectionString.includes('test') || process.exit(666))
afterAll(db.$pool.end);

describe('Events common', () => {
    const eventTime = [mskMoment('2020-01-01 12:00'), mskMoment('2020-01-03 15:00')]
    const eventTimeOutRange = [mskMoment('2022-01-01 12:00'), mskMoment('2022-01-03 15:00')]
    const yearRange = mkInterval('[2020-01-01 00:00, 2021-01-02 00:00)')

    beforeEach(async () => {
        await cleanDb()
    })

    test('count events on nearest date', async () => {
        await syncEventsDb4Test([
            getMockEvent({title: 'A', eventTime}),
            getMockEvent({title: 'B', eventTime: eventTimeOutRange}),
        ])
        const count = await db.repoEventsCommon.countEvents({
            interval: yearRange
        })
        expect(count).toEqual(1)
    })
})