import { db, dbCfg } from '../../../src/database/db'
import { getMockEvent, syncDatabase4Test } from './db-test-utils'
import { date } from '../../lib/timetable/test-utils'

beforeAll(() => dbCfg.connectionString.includes('test') || process.exit(666))
afterAll(db.$pool.end);

describe('Users', () => {

    beforeEach(async () => await db.none('DELETE FROM cb_events'))

    test('Snapshot can be taken', async () => {
        const eventTime = [[date('2020-01-01 12:00'), date('2020-01-03 15:00')]]
        await syncDatabase4Test([
            getMockEvent({title: 'A', category: 'theaters', eventTime, tag_level_1: ['#A', '#B', '#C']}),
        ])

        await db.repoSnapshot.takeSnapshot()
    })
})