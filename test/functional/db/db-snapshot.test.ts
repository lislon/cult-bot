import { db, dbCfg } from '../../../src/database/db'
import { getMockEvent, syncEventsDb4Test } from './db-test-utils'
import { date } from '../../lib/timetable/test-utils'

beforeAll(() => dbCfg.connectionString.includes('test') || process.exit(666))
afterAll(db.$pool.end);

describe('Users', () => {

    beforeEach(async () => await db.none('DELETE FROM cb_events'))

    test('Snapshot can be taken', async () => {
        const eventTime = [[date('2020-01-01 12:00'), date('2020-01-03 15:00')]]
        await syncEventsDb4Test([
            getMockEvent({title: 'A', category: 'theaters', eventTime, tag_level_1: ['#A', '#B', '#C']}),
        ])

        await db.repoSnapshot.takeSnapshot('lisa', date('2020-01-03 18:00'))
        const meta = await db.repoSnapshot.getSnapshotMeta()
        expect(meta).toStrictEqual({
            createdBy: 'lisa',
            createdAt: date('2020-01-03 18:00')
        })
    })
})
