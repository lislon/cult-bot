import { mskMoment } from '../../../src/util/moment-msk'
import { findEventsDuringRange, findTopEventsInRange } from '../../../src/db/events'
import { cleanDb, getMockEvent, initializeDbTests } from './db-test-utils'
import { syncDatabase } from '../../../src/db/sync'

async function expectResults(number: number, [from, to]: string[]) {
    const range = [mskMoment(from), mskMoment(to)]
    const findEventsDuringRange1 = await findEventsDuringRange(range)
    expect(findEventsDuringRange1.length).toEqual(number)
}

initializeDbTests()

describe('Top events', () => {
    beforeEach(async () => {
        await cleanDb()
    })

    test('single event', async () => {
        await syncDatabase([getMockEvent({
            timeIntervals: [
                [mskMoment('2020-01-02 15:00')]
            ],
            category: 'theaters'
        })])

        const range = [mskMoment('2020-01-01 15:00'), mskMoment('2020-01-03 15:00')]
        const top = await findTopEventsInRange('theaters', range)
        expect(top.length).toEqual(1)
    })

    test('do not show exhibition before close 1.5 hours', async () => {
        await syncDatabase([getMockEvent({
            timeIntervals: [
                [mskMoment('2020-01-01 15:00'), mskMoment('2020-01-01 20:00')]
            ],
            category: 'exhibitions'
        })])


        const uspeemRange = [mskMoment('2020-01-01 18:29'), mskMoment('2020-01-02 00:00')]
        const uspeemResult = await findTopEventsInRange('exhibitions', uspeemRange)

        const apazdunRange = [mskMoment('2020-01-01 18:30'), mskMoment('2020-01-02 00:00')]
        const apazdunResult = await findTopEventsInRange('exhibitions', apazdunRange)

        expect(uspeemResult.length).toEqual(1)
        expect(apazdunResult.length).toEqual(0)
    })

    test('include anytime events when no primary results', async () => {
        await syncDatabase([
            getMockEvent({
                title: 'PRIMARY',
                timeIntervals: [
                    [mskMoment('2020-01-01 15:00'), mskMoment('2020-01-01 20:00')]
                ],
                anytime: false,
                rating: 5
            }),
            getMockEvent({
                title: 'AUX',
                timeIntervals: [
                    [mskMoment('2000-01-01 00:00'), mskMoment('2022-01-01 00:00')]
                ],
                anytime: true,
                rating: 4
            })]
        )
        const range = [mskMoment('2020-01-01 00:00'), mskMoment('2020-01-01 23:59')]
        const events = await findTopEventsInRange('theaters', range)
        expect(events.map(e => e.title)).toEqual(['PRIMARY', 'AUX'])
    })

    test('sorting is done by rating', async () => {
        const timeIntervals = [
            [mskMoment('2020-01-01 15:00'), mskMoment('2020-01-01 20:00')]
        ]
        await syncDatabase([
            getMockEvent({
                title: '1. NOT SO GOOD',
                timeIntervals: timeIntervals,
                rating: 1
            }),
            getMockEvent({
                title: '2. BEST',
                timeIntervals: timeIntervals,
                rating: 19
            }),
            getMockEvent({
                title: '3. BETTER',
                timeIntervals: timeIntervals,
                rating: 10
            })
            ]
        )
        const range = [mskMoment('2020-01-01 00:00'), mskMoment('2020-01-01 23:59')]
        const events = await findTopEventsInRange('theaters', range, 2)
        expect(events.map(e => e.title)).toEqual(['2. BEST', '3. BETTER'])
    })
})

describe('Search intervals', () => {

    describe('SINGLE_INTERVAL [restriction]', () => {
        beforeAll(async () => {
            await cleanDb()
            await syncDatabase([getMockEvent({
                timeIntervals: [
                    [mskMoment('2020-01-02 15:00')]
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

    describe('(range). [restriction]', () => {
        beforeAll(async () => {
            await cleanDb()
            await syncDatabase([getMockEvent({
                timeIntervals: [[
                    mskMoment('2020-01-01 12:00'),
                    mskMoment('2020-01-01 18:00')],
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
            await expectResults(1, [
                '2020-01-01 00:00',
                '2020-01-01 12:00'])
        })

        test('[  ]( )', async () => {
            await expectResults(0, [
                '2020-01-01 00:00',
                '2020-01-01 01:00'])
        })

    })
});