import { expectedTitles, getMockEvent, syncDatabase4Test } from './db-test-utils'
import { mskMoment } from '../../../src/util/moment-msk'
import { db, dbCfg } from '../../../src/db'

beforeAll(() => dbCfg.connectionString.includes('test') || process.exit(666))
afterAll(db.$pool.end);

describe('Admin', () => {

    const eventTime = [mskMoment('2020-01-01 12:00'), mskMoment('2020-01-03 15:00')]
    const yearRange = [mskMoment('2020-01-01 00:00'), mskMoment('2021-01-02 00:00')]

    test('find all by cat', async () => {
        await syncDatabase4Test([
                getMockEvent({title: 'A', eventTime, category: 'movies', rating: 5}),
                getMockEvent({title: 'B', eventTime, category: 'movies', rating: 20, anytime: true})
            ]
        )

        expectedTitles(['A', 'B'], await db.repoAdmin.findAllEventsAdmin('movies', yearRange, 10))
    })

    test('find stats', async () => {
        await syncDatabase4Test([
                getMockEvent({title: 'A', eventTime, category: 'movies', rating: 5}),
                getMockEvent({title: 'B', eventTime, category: 'theaters', rating: 20})
            ]
        )
        const actual = await db.repoAdmin.findStats(yearRange)
        expect(actual).toEqual([
            {
                'category': 'movies',
                'count': '1'
            },
            {
                'category': 'theaters',
                'count': '1'
            }
        ])
    })
})
