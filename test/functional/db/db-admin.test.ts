import { expectedTitles, expectedTitlesStrict, getMockEvent, syncDatabase4Test } from './db-test-utils'
import { db, dbCfg } from '../../../src/database/db'
import { date, mkInterval } from '../../lib/timetable/test-utils'

beforeAll(() => dbCfg.connectionString.includes('test') || process.exit(666))
afterAll(db.$pool.end)

describe('Admin', () => {

    const eventTime = [date('2020-01-01 12:00'), date('2020-01-03 15:00')]
    const yearRange = mkInterval('[2020-01-01 00:00, 2021-01-02 00:00)')

    test('find all by cat', async () => {
        await syncDatabase4Test([
                getMockEvent({title: 'A', eventTime, category: 'movies', rating: 5}),
                getMockEvent({title: 'B', eventTime, category: 'movies', rating: 20, anytime: true})
            ]
        )

        expectedTitles(['A', 'B'], await db.repoAdmin.findAllEventsByCat('movies', yearRange, 10))
    })

    test('find stats by cat', async () => {
        await syncDatabase4Test([
                getMockEvent({title: 'A', eventTime, category: 'movies', rating: 5}),
                getMockEvent({title: 'B', eventTime, category: 'theaters', rating: 20})
            ]
        )
        const actual = await db.repoAdmin.findStatsByCat(yearRange)
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

    test('find stats by reviewer', async () => {
        await syncDatabase4Test([
                getMockEvent({title: 'A', eventTime: [date('2020-01-01 12:00')], reviewer: 'Лена'}),
                getMockEvent({title: 'B', eventTime: [date('2020-05-01 12:00')], reviewer: 'Лена'}),
                getMockEvent({title: 'C', eventTime: [date('2020-01-01 12:00')], reviewer: 'Аня'})
            ]
        )
        const actual = await db.repoAdmin.findStatsByReviewer(mkInterval('[2020-01-01 00:00, 2020-01-02 00:00)'))
        expect(actual).toEqual([
            {
                'reviewer': 'Аня',
                'count': '1'
            },
            {
                'reviewer': 'Лена',
                'count': '1'
            }
        ])
    })

    test('find events reviewer', async () => {
        await syncDatabase4Test([
                getMockEvent({title: 'A', eventTime: [date('2020-01-01 12:00')], reviewer: 'Лена'}),
                getMockEvent({title: 'B', eventTime: [date('2020-05-01 12:00')], reviewer: 'Лена'}),
                getMockEvent({title: 'C', eventTime: [date('2020-01-01 12:00')], reviewer: 'Аня', rating: 20, anytime: true}),
                getMockEvent({title: 'D', eventTime: [date('2020-01-01 12:00')], reviewer: 'Аня', rating: 1}),
            ]
        )
        const actual = await db.repoAdmin.findAllEventsByReviewer('Аня', mkInterval('[2020-01-01 00:00, 2020-01-02 00:00)'))
        expectedTitlesStrict(['D', 'C'], actual)
    })
})
