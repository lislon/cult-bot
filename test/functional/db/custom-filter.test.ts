import { cleanDb, expectedTitles, getMockEvent, MockEvent, syncDatabase4Test } from './db-test-utils'
import { db, dbCfg } from '../../../src/db'
import { date, interval } from '../../lib/timetable/test-utils'


const weekendRange = interval('[2020-01-01 00:00, 2020-01-03 00:00)')
const eventTime = [[date('2020-01-01 12:00'), date('2020-01-03 15:00')]]
const outOfIntervalEventTime = [[date('2020-02-01 12:00'), date('2020-02-03 15:00')]]

beforeAll(() => dbCfg.connectionString.includes('test') || process.exit(666))
afterAll(db.$pool.end);

describe('Filtering', () => {

    beforeEach(async () => {
        await cleanDb()
    })

    test('search only by oblasti works', async () => {
        await syncDatabase4Test([
            getMockEvent({title: 'A', category: 'theaters', eventTime, tag_level_1: ['#A', '#B', '#C']}),
            getMockEvent({title: 'B', category: 'theaters', eventTime, tag_level_1: ['#A', '#B']}),
            getMockEvent({title: 'C', category: 'theaters', eventTime, tag_level_1: ['#A']})
        ])
        expectedTitles(['A', 'B', 'C'], await db.repoCustomEvents.findEventsCustomFilter({oblasti: ['theaters.#A', 'theaters.#B'], weekendRange}))

    }, 1000000)

    test('no oblasti means all oblasti', async () => {
        await syncDatabase4Test([
            getMockEvent({title: 'A', category: 'theaters', eventTime, tag_level_1: ['#A', '#B', '#C']}),
            getMockEvent({title: 'B', category: 'theaters', eventTime, tag_level_1: ['#A', '#B']}),
            getMockEvent({title: 'C', category: 'theaters', eventTime, tag_level_1: ['#A']})
        ])

        expectedTitles(['A', 'B', 'C'], await db.repoCustomEvents.findEventsCustomFilter({oblasti: [], weekendRange}))
    }, 1000000)

    test('search only by cennosti works', async () => {
        await syncDatabase4Test([
            getMockEvent({title: 'A', category: 'theaters', eventTime, tag_level_2: ['#ЗОЖ', '#комфорт', 'премьера']}),
            getMockEvent({title: 'B', category: 'theaters', eventTime, tag_level_2: ['#ЗОЖ', '#комфорт']}),
            getMockEvent({title: 'C', category: 'concerts', eventTime, tag_level_2: ['#ЗОЖ']})
        ])

         expectedTitles(['A', 'B'], await db.repoCustomEvents.findEventsCustomFilter({cennosti: ['#ЗОЖ', '#комфорт'], weekendRange}))
    }, 1000000)


    test('search without tags works', async () => {
        await syncDatabase4Test([
            getMockEvent({title: 'A', category: 'theaters', eventTime}),
            getMockEvent({title: 'B', category: 'concerts', eventTime, tag_level_2: ['#ЗОЖ']})
        ])

        expectedTitles(['A', 'B'], await db.repoCustomEvents.findEventsCustomFilter({weekendRange}))
    }, 1000000)

    test('search filters out of interval', async () => {
        await syncDatabase4Test([
            getMockEvent({title: 'A', eventTime: outOfIntervalEventTime}),
            getMockEvent({title: 'B', eventTime})
        ])

        expectedTitles(['B'], await db.repoCustomEvents.findEventsCustomFilter({weekendRange}))
    }, 1000000)

    test('search only all except online', async () => {
        await syncDatabase4Test([
            getMockEvent({title: 'A', eventTime, address: 'онлайн'}),
            getMockEvent({title: 'B', eventTime, address: ''}),
        ])

        expectedTitles(['B'], await db.repoCustomEvents.findEventsCustomFilter({format: 'outdoor', weekendRange}))
        expectedTitles(['A'], await db.repoCustomEvents.findEventsCustomFilter({format: 'online', weekendRange}))
        expectedTitles(['A', 'B'], await db.repoCustomEvents.findEventsCustomFilter({weekendRange}))
    }, 1000000)

    test('search by many intervals', async () => {
        await syncDatabase4Test([
            getMockEvent({title: 'A10', eventTime: [[date('2020-01-01 10:00'), date('2020-01-01 11:00')]]}),
            getMockEvent({title: 'A11', eventTime: [[date('2020-01-01 11:00'), date('2020-01-01 12:00')]]}),
            getMockEvent({title: 'A12', eventTime: [[date('2020-01-01 12:00'), date('2020-01-01 13:00')]]}),
            getMockEvent({title: 'A13', eventTime: [[date('2020-01-01 13:00'), date('2020-01-01 14:00')]]}),
            getMockEvent({title: 'A14', eventTime: [[date('2020-01-01 14:00'), date('2020-01-01 15:00')]]}),
            getMockEvent({title: 'B10', eventTime: [[date('2020-01-03 10:00'), date('2020-01-03 15:00')]]})
        ])
        const weekendAlreadyStartedRange = interval('[2020-01-01 11:00, 2020-01-03 00:00)')

        expectedTitles(['A12', 'A13'], await db.repoCustomEvents.findEventsCustomFilter({weekendRange: weekendAlreadyStartedRange, timeIntervals: [
                interval('[2020-01-01 10:00, 2020-01-01 11:00)'),
                interval('[2020-01-01 12:00, 2020-01-01 13:00)'),
                interval('[2020-01-01 13:30, 2020-01-01 13:35)'),
            ]}))
    }, 1000000)
});


describe('Логика с детьми', () => {
    beforeEach(async () => {
        await syncDatabase4Test([
            getMockEvent({title: 'D0', eventTime, tag_level_2: ['#сдетьми0+']}),
            getMockEvent({title: 'D6', eventTime, tag_level_2: ['#сдетьми6+']}),
            getMockEvent({title: 'D12', eventTime, tag_level_2: ['#сдетьми12+']}),
            getMockEvent({title: 'D16', eventTime, tag_level_2: ['#сдетьми16+']}),
            getMockEvent({title: 'ND', eventTime})
        ])
    })

    test('Если выбран 16+, то ищем два тега: 16+ и 12+', async () => {
        await expectedTitles(['D16', 'D12'], await db.repoCustomEvents.findEventsCustomFilter({weekendRange, cennosti: ['#сдетьми16+']}))
    }, 1000000)

    test('Если выбран 12+, то ищем 12+ и 6+', async () => {
        expectedTitles(['D12', 'D6'], await db.repoCustomEvents.findEventsCustomFilter({weekendRange, cennosti: ['#сдетьми12+']}))
    }, 1000000)

    test('Если выбран 6+, то ищем 6+ и 0+', async () => {
        expectedTitles(['D6', 'D0'], await db.repoCustomEvents.findEventsCustomFilter({weekendRange, cennosti: ['#сдетьми6+']}))
    }, 1000000)

    test('Если выбран 0+, то ищем только 0+', async () => {
        expectedTitles(['D0'], await db.repoCustomEvents.findEventsCustomFilter({weekendRange, cennosti: ['#сдетьми0+']}))
    }, 1000000)
})

describe('Sorting & Paging', () => {

    const goodOrder: Partial<MockEvent>[] = [
        {title: 'A', eventTime, rating: 10},
        {title: 'B', eventTime, rating: 5},
        {title: 'C', eventTime, rating: 5},
        {title: 'D', eventTime, anytime: true, rating: 15},
        {title: 'E', eventTime, anytime: true, rating: 5},
        {title: 'F', eventTime, anytime: true, rating: 5},
    ]

    beforeEach(async () => {
        const pseudoRandom = [...goodOrder].reverse()
        await syncDatabase4Test(pseudoRandom.map(r => getMockEvent(r)))
    })

    test('Sorting', async () => {
        const events = await db.repoCustomEvents.findEventsCustomFilter({weekendRange, limit: 100})
        expect((events).map(t => t.title)).toEqual(goodOrder.map(t => t.title))
    }, 1000000)

    test('Paging', async () => {
        const events = await db.repoCustomEvents.findEventsCustomFilter({weekendRange, limit: 3, offset: 1})
        expect((events).map(t => t.title)).toEqual(['B', 'C', 'D'])
    }, 1000000)

    test('Counting', async () => {
        const count = await db.repoCustomEvents.countEventsCustomFilter({weekendRange})
        expect(count).toEqual(6)
    }, 1000000)
})