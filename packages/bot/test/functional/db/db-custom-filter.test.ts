import { db, dbCfg } from '../../../src/database/db'
import { date, mkInterval } from '../../lib/timetable/test-utils'
import { cleanDb, expectedIds, getMockEvent, MockEvent, syncEventsDb4Test } from './db-test-utils'


const weekendRange = mkInterval('[2020-01-01 00:00, 2020-01-03 00:00)')
const eventTime = [[date('2020-01-01 12:00'), date('2020-01-03 15:00')]]
const outOfIntervalEventTime = [[date('2020-02-01 12:00'), date('2020-02-03 15:00')]]

beforeAll(() => dbCfg.connectionString.includes('test') || process.exit(666))
afterAll(db.$pool.end)

describe('Filtering', () => {

    beforeEach(async () => {
        await cleanDb()
    })

    test('search only by rubrics works', async () => {
        const [A, B, C] = await syncEventsDb4Test([
            getMockEvent({title: 'A', category: 'theaters', eventTime, tag_level_1: ['#A', '#B', '#C']}),
            getMockEvent({title: 'B', category: 'theaters', eventTime, tag_level_1: ['#A', '#B']}),
            getMockEvent({title: 'C', category: 'theaters', eventTime, tag_level_1: ['#A']})
        ])
        expectedIds([A, B, C], await db.repoCustomEvents.findEventIdsCustomFilter({
            rubrics: ['theaters.#A', 'theaters.#B'],
            weekendRange
        }))

    }, 1000000)

    test('no rubrics means all rubrics', async () => {
        const [A, B, C] = await syncEventsDb4Test([
            getMockEvent({title: 'A', category: 'theaters', eventTime, tag_level_1: ['#A', '#B', '#C']}),
            getMockEvent({title: 'B', category: 'theaters', eventTime, tag_level_1: ['#A', '#B']}),
            getMockEvent({title: 'C', category: 'theaters', eventTime, tag_level_1: ['#A']})
        ])

        expectedIds([A, B, C], await db.repoCustomEvents.findEventIdsCustomFilter({rubrics: [], weekendRange}))
    }, 1000000)

    test('search only by priorities works', async () => {
        const [A, B, C] = await syncEventsDb4Test([
            getMockEvent({
                title: 'A',
                category: 'theaters',
                eventTime,
                tag_level_2: ['#компанией', '#комфорт', '#премьера']
            }),
            getMockEvent({title: 'B', category: 'theaters', eventTime, tag_level_2: ['#компанией', '#комфорт']}),
            getMockEvent({title: 'C', category: 'concerts', eventTime, tag_level_2: ['#компанией']})
        ])

        expectedIds([A, B], await db.repoCustomEvents.findEventIdsCustomFilter({
            priorities: ['#компанией', '#комфорт'],
            weekendRange
        }))
    }, 1000000)


    test('search without tags works', async () => {
        const [A, B, C] = await syncEventsDb4Test([
            getMockEvent({title: 'A', category: 'theaters', eventTime}),
            getMockEvent({title: 'B', category: 'concerts', eventTime, tag_level_2: ['#компанией']})
        ])

        expectedIds([A, B], await db.repoCustomEvents.findEventIdsCustomFilter({weekendRange}))
    }, 1000000)

    test('search filters out of interval', async () => {
        const [A, B] = await syncEventsDb4Test([
            getMockEvent({title: 'A', eventTime: outOfIntervalEventTime}),
            getMockEvent({title: 'B', eventTime})
        ])

        expectedIds([B], await db.repoCustomEvents.findEventIdsCustomFilter({weekendRange}))
    }, 1000000)

    test('search only all except online', async () => {
        const [A, B] = await syncEventsDb4Test([
            getMockEvent({title: 'A', eventTime, address: 'онлайн'}),
            getMockEvent({title: 'B', eventTime, address: ''}),
        ])

        expectedIds([B], await db.repoCustomEvents.findEventIdsCustomFilter({format: 'outdoor', weekendRange}))
        expectedIds([A], await db.repoCustomEvents.findEventIdsCustomFilter({format: 'online', weekendRange}))
        expectedIds([A, B], await db.repoCustomEvents.findEventIdsCustomFilter({weekendRange}))
    }, 1000000)

    test('search by many intervals', async () => {
        const [A10, A11, A12, A13, A14, B10] = await syncEventsDb4Test([
            getMockEvent({title: 'A10', eventTime: [[date('2020-01-01 10:00'), date('2020-01-01 11:00')]]}),
            getMockEvent({title: 'A11', eventTime: [[date('2020-01-01 11:00'), date('2020-01-01 12:00')]]}),
            getMockEvent({title: 'A12', eventTime: [[date('2020-01-01 12:00'), date('2020-01-01 13:00')]]}),
            getMockEvent({title: 'A13', eventTime: [[date('2020-01-01 13:00'), date('2020-01-01 14:00')]]}),
            getMockEvent({title: 'A14', eventTime: [[date('2020-01-01 14:00'), date('2020-01-01 15:00')]]}),
            getMockEvent({title: 'B10', eventTime: [[date('2020-01-03 10:00'), date('2020-01-03 15:00')]]})
        ])
        const weekendAlreadyStartedRange = mkInterval('[2020-01-01 11:00, 2020-01-03 00:00)')

        expectedIds([A12, A13], await db.repoCustomEvents.findEventIdsCustomFilter({
            weekendRange: weekendAlreadyStartedRange, timeIntervals: [
                mkInterval('[2020-01-01 10:00, 2020-01-01 11:00)'),
                mkInterval('[2020-01-01 12:00, 2020-01-01 13:00)'),
                mkInterval('[2020-01-01 13:30, 2020-01-01 13:35)'),
            ]
        }))
    }, 1000000)

    test('search expensive', async () => {
        const [A, B, C] = await syncEventsDb4Test([
            getMockEvent({title: 'A', eventTime, tag_level_2: ['#доступноподеньгам']}),
            getMockEvent({title: 'B', eventTime, tag_level_2: ['#бесплатно']}),
            getMockEvent({title: 'C', eventTime, tag_level_2: ['#компанией', '#_недешево']})
        ])
        expectedIds([B, C], await db.repoCustomEvents.findEventIdsCustomFilter({
            priorities: ['#_недешево', '#бесплатно'],
            weekendRange
        }))

    }, 1000000)

    test('do not include upper interval', async () => {
        const [A, B] = await syncEventsDb4Test([
            getMockEvent({title: 'A', eventTime: [date('2020-01-01 10:00')]}),
            getMockEvent({title: 'B', eventTime: [[date('2020-01-01 10:00'), date('2020-01-01 11:00')]]}),
        ])
        const weekendAlreadyStartedRange = mkInterval('[2020-01-01 00:00, 2020-01-03 00:00)')

        expectedIds([], await db.repoCustomEvents.findEventIdsCustomFilter({
            weekendRange: weekendAlreadyStartedRange, timeIntervals: [
                mkInterval('[2020-01-01 00:00, 2020-01-01 10:00)'),
            ]
        }))
    }, 1000000)

})

describe('Логика с детьми', () => {
    let D0: number
    let D6: number
    let D12: number
    let D16: number
    let ND: number

    beforeAll(async () => {

        await cleanDb();
        [D0, D6, D12, D16, ND] = await syncEventsDb4Test([
            getMockEvent({title: 'D0', eventTime, tag_level_2: ['#сдетьми0+']}),
            getMockEvent({title: 'D6', eventTime, tag_level_2: ['#сдетьми6+']}),
            getMockEvent({title: 'D12', eventTime, tag_level_2: ['#сдетьми12+']}),
            getMockEvent({title: 'D16', eventTime, tag_level_2: ['#сдетьми16+']}),
            getMockEvent({title: 'ND', eventTime})
        ])
    })

    test('Если выбран 16+, то ищем два тега: 16+ и 12+', async () => {
        await expectedIds([D16, D12], await db.repoCustomEvents.findEventIdsCustomFilter({
            weekendRange,
            priorities: ['#сдетьми16+']
        }))
    }, 1000000)

    test('Если выбран 12+, то ищем 12+ и 6+', async () => {
        expectedIds([D12, D6], await db.repoCustomEvents.findEventIdsCustomFilter({
            weekendRange,
            priorities: ['#сдетьми12+']
        }))
    }, 1000000)

    test('Если выбран 6+, то ищем 6+ и 0+', async () => {
        expectedIds([D6, D0], await db.repoCustomEvents.findEventIdsCustomFilter({
            weekendRange,
            priorities: ['#сдетьми6+']
        }))
    }, 1000000)

    test('Если выбран 0+, то ищем только 0+', async () => {
        expectedIds([D0], await db.repoCustomEvents.findEventIdsCustomFilter({
            weekendRange,
            priorities: ['#сдетьми0+']
        }))
    }, 1000000)
})

describe('Sorting & Paging', () => {

    const goodOrder: Partial<MockEvent & { id: number }>[] = [
        {title: 'A', eventTime, rating: 10},
        {title: 'B', eventTime, rating: 5},
        {title: 'C', eventTime, rating: 5},
        {title: 'D', eventTime, anytime: true, rating: 15},
        {title: 'E', eventTime, anytime: true, rating: 5},
        {title: 'F', eventTime, anytime: true, rating: 5},
    ]

    beforeAll(async () => {
        const pseudoRandom = [...goodOrder].reverse()
        await cleanDb()
        const ids = await syncEventsDb4Test(pseudoRandom.map(r => getMockEvent(r)))
        pseudoRandom.forEach((e, index) => e.id = ids[index])
    })

    test('Sorting', async () => {
        const eventIds = await db.repoCustomEvents.findEventIdsCustomFilter({weekendRange, limit: 100})
        expect(eventIds).toEqual(goodOrder.map(t => t.id))
    }, 1000000)

    test('Paging', async () => {
        const eventIds = await db.repoCustomEvents.findEventIdsCustomFilter({weekendRange, limit: 3, offset: 1})
        const toId = (title: string) => goodOrder.find(o => o.title === title).id
        expect(eventIds).toEqual(['B', 'C', 'D'].map(toId))
    }, 1000000)

    test('Counting', async () => {
        const count = await db.repoCustomEvents.countEventsCustomFilter({weekendRange})
        expect(count).toEqual(6)
    }, 1000000)
})