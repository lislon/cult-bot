import { expectedTitles, freshDb, getMockEvent, initializeDbTests } from './db-test-utils'
import { mskMoment } from '../../../src/util/moment-msk'
import { syncDatabase } from '../../../src/db/sync'
import { findAllEventsAdmin, findStats } from '../../../src/db/db-admin'

initializeDbTests()

describe('Admin', () => {

    freshDb()

    const eventTime = [mskMoment('2020-01-01 12:00'), mskMoment('2020-01-03 15:00')]

    const yearRange = [mskMoment('2020-01-01 00:00'), mskMoment('2021-01-02 00:00')]

    test('find all by cat', async () => {
        await syncDatabase([
            getMockEvent({ title: 'A', eventTime, category: 'movies', rating: 5}),
            getMockEvent({ title: 'B', eventTime, category: 'movies', rating: 20, anytime: true})
            ]
        )

        expectedTitles(['A', 'B'], await findAllEventsAdmin('movies', yearRange, 10))
    })

    test('find stats', async () => {
        await syncDatabase([
                getMockEvent({ title: 'A', eventTime, category: 'movies', rating: 5}),
                getMockEvent({ title: 'B', eventTime, category: 'theaters', rating: 20})
            ]
        )
        const actual = await findStats(yearRange)
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
