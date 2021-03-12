import { cleanDb, getMockEvent, syncEventsDb4Test } from './db-test-utils'
import { db, dbCfg } from '../../../src/database/db'
import { date, mkInterval } from '../../util/timetable-util'
import { mskMoment } from '../../../src/util/moment-msk'


export async function expectResults(number: number, [from, to]: string[]) {
    const range = {start: date(from), end: date(to)}
    const top = await db.repoTopEvents.getTopIds({category: 'theaters', interval: range})
    expect(top.length).toEqual(number)
}

beforeAll(() => dbCfg.connectionString.includes('test') || process.exit(666))
afterAll(db.$pool.end);

describe('Top events', () => {
    beforeEach(async () => {
        await cleanDb()
    })

    test('single event', async () => {
        const [A] = await syncEventsDb4Test([getMockEvent({
            title: 'A',
            eventTime: [
                date('2020-01-02 15:00'),
                date('2020-01-02 16:00')
            ],
            category: 'theaters'
        })])

        const interval = mkInterval('[2020-01-01 15:00, 2020-01-03 15:00)')
        const events = await db.repoTopEvents.getTopIds({category: 'theaters', interval: interval})
        expect([A]).toStrictEqual(events)
    })

    test('do not show exhibition when less then 1 hours before close', async () => {
        const [A, B, C] = await syncEventsDb4Test([getMockEvent({
            eventTime: [
                [date('2020-01-01 15:00'), date('2020-01-01 20:00')]
            ],
            category: 'exhibitions'
        })])


        const uspeemRange = mkInterval('[2020-01-01 18:59,2020-01-02 00:00)')
        const uspeemResult = await db.repoTopEvents.getTopIds({category: 'exhibitions', interval: uspeemRange})

        const apazdunRange = mkInterval('[2020-01-01 19:00,2020-01-02 00:00)')
        const apazdunResult = await db.repoTopEvents.getTopIds({category: 'exhibitions', interval: apazdunRange})

        expect(uspeemResult.length).toEqual(1)
        expect(apazdunResult.length).toEqual(0)
    })

    test('exhibitions subcategory', async () => {
        const [A, B] = await syncEventsDb4Test([
            getMockEvent({
                title: 'A',
                eventTime: [
                    date('2020-01-02 15:00'),
                ],
                category: 'exhibitions',
                tag_level_1: ['#постоянныеколлекции']
            }),
            getMockEvent({
                title: 'B',
                eventTime: [
                    date('2020-01-02 15:00'),
                ],
                category: 'exhibitions'
            })])

        const interval = mkInterval('[2020-01-01 15:00, 2020-01-03 15:00)')
        const events = await db.repoTopEvents.getTopIds({
            category: 'exhibitions',
            rubrics: ['exhibitions.#постоянныеколлекции'],
            interval: interval
        })
        expect([A]).toStrictEqual(events)
    })

    test('include anytime events when no primary results', async () => {
        const [PRIMARY, AUX] = await syncEventsDb4Test([
            getMockEvent({
                title: 'PRIMARY',
                eventTime: [
                    [date('2020-01-01 15:00'), date('2020-01-01 20:00')]
                ],
                anytime: false,
                rating: 5
            }),
            getMockEvent({
                title: 'AUX',
                eventTime: [
                    [date('2000-01-01 00:00'), date('2022-01-01 00:00')]
                ],
                anytime: true,
                rating: 4
            })]
        )
        const interval = mkInterval('2020-01-01 00:00,2020-01-01 23:59)')
        const events = await db.repoTopEvents.getTopIds({category: 'theaters', interval})
        expect([PRIMARY, AUX]).toStrictEqual(events)
    })

    test('sorting is done by rating', async () => {
        const timeIntervals = [
            [date('2020-01-01 15:00'), date('2020-01-01 20:00')]
        ]
        const [idNotSoGood, idBest, idBetter] = await syncEventsDb4Test([
            getMockEvent({
                title: '1. NOT SO GOOD',
                eventTime: timeIntervals,
                rating: 1
            }),
            getMockEvent({
                title: '2. BEST',
                eventTime: timeIntervals,
                rating: 19
            }),
                getMockEvent({
                    title: '3. BETTER',
                    eventTime: timeIntervals,
                    rating: 10
                })
            ]
        )
        const interval = mkInterval('[2020-01-01 00:00, 2020-01-01 23:59)')
        const events = await db.repoTopEvents.getTopIds({category: 'theaters', interval, limit: 2})
        expect([idBest, idBetter]).toStrictEqual(events)
    })

    test('paging is work', async () => {
        const eventTime = [
            [mskMoment('2020-01-01 15:00'), mskMoment('2020-01-01 20:00')]
        ]
        const [Atimed, Btimed, Conline, Donline] = await syncEventsDb4Test([
            getMockEvent({
                title: 'A - timed',
                eventTime,
                order_rnd: 1
            }),
            getMockEvent({
                title: 'B - timed',
                eventTime,
                order_rnd: 2
            }),
                getMockEvent({
                    title: 'C - online',
                    anytime: true,
                    eventTime,
                    order_rnd: 1
                }),
                getMockEvent({
                    title: 'D - online',
                    anytime: true,
                    eventTime,
                    order_rnd: 2
                })
            ]
        )
        const interval = mkInterval('[2020-01-01 00:00, 2020-01-01 23:59)')
        const events = await db.repoTopEvents.getTopIds({category: 'theaters', interval, limit: 2, offset: 1})
        expect([Btimed, Conline]).toStrictEqual(events)
    })

    test('even with is_anytime = true we should intersect intervals', async () => {
        const [A, B] = await syncEventsDb4Test([
                getMockEvent({
                    title: 'A',
                    eventTime: [date('2020-01-01 00:00'), date('2020-01-01 10:00')],
                    anytime: true
                }),
                getMockEvent({
                    title: 'B',
                    eventTime: [date('2020-01-01 15:00'), date('2020-01-01 16:00')],
                    anytime: true
                }),
            ]
        )
        const interval = mkInterval('[2020-01-01 00:00, 2020-01-01 10:00)')
        const events = await db.repoTopEvents.getTopIds({category: 'theaters', interval})
        expect([A]).toStrictEqual(events)
    })

    test('count works', async () => {
        const interval = mkInterval('[2020-01-01 00:00, 2020-01-01 10:00)')
        const count = await db.repoTopEvents.getTopIdsCount({category: 'theaters', interval})
        expect(0).toStrictEqual(count)
    })
})


describe('Search intervals - SINGLE_INTERVAL [restriction]', () => {
    beforeEach(async () => {
        await cleanDb()
    })

    beforeEach(async () => {
        const [A, B, C] = await syncEventsDb4Test([getMockEvent({
            eventTime: [
                date('2020-01-02 15:00')
            ]
        })])
    })

    test('[ SINGLE_INTERVAL ]', async () => {
        await expectResults(1, [
            '2020-01-02 15:00',
            '2020-01-02 16:00'])
    })

    test('SINGLE_INTERVAL   [  ]', async () => {
        await expectResults(0, [
            '2020-01-05 15:00',
            '2020-01-05 16:00'])
    })

    test('[  ]   SINGLE_INTERVAL', async () => {
        await expectResults(0, [
            '2020-01-01 01:00',
            '2020-01-01 02:00'])
    })
})

describe('Search intervals -  (range). [restriction]', () => {
    beforeEach(async () => {
        await cleanDb()
    })

    beforeEach(async () => {
        const [A, B, C] = await syncEventsDb4Test([getMockEvent({
            eventTime: [[
                date('2020-01-01 12:00'),
                date('2020-01-01 18:00')],
            ]
        })])
    })

    test('()  []', async () => {
        await expectResults(0, [
            '2020-01-01 18:00',
            '2020-01-01 20:00'])
    })

    test('( [ ) ]', async () => {
        await expectResults(1, [
            '2020-01-01 15:00',
            '2020-01-01 20:00'])
    })

    test('[ ( ) ]', async () => {
        await expectResults(1, [
            '2020-01-01 00:00',
            '2020-01-01 23:00'])
    })

    test('[ ( ] )', async () => {
        await expectResults(0, [
            '2020-01-01 00:00',
            '2020-01-01 12:00'])
    })

    test('[  ]( )', async () => {
        await expectResults(0, [
            '2020-01-01 00:00',
            '2020-01-01 01:00'])
    })

})


