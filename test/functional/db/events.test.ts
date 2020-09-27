import { mskMoment } from '../../../src/util/moment-msk'
import { findTopEventsInRange } from '../../../src/db/events'
import { cleanDb, expectedTitlesStrict, freshDb, getMockEvent } from './db-test-utils'
import { syncDatabase } from '../../../src/db/sync'

export async function expectResults(number: number, [from, to]: string[]) {
    const range = [mskMoment(from), mskMoment(to)]
    const top = await findTopEventsInRange('theaters', range)
    expect(top.length).toEqual(number)
}

describe('Top events', () => {
    freshDb()

    test('single event', async () => {
        await syncDatabase([getMockEvent({
            title: 'A',
            eventTime: [
                mskMoment('2020-01-02 15:00'),
                mskMoment('2020-01-02 16:00')
            ],
            category: 'theaters'
        })])

        const range = [mskMoment('2020-01-01 15:00'), mskMoment('2020-01-03 15:00')]
        expectedTitlesStrict(['A'], await findTopEventsInRange('theaters', range))
    })

    test('do not show exhibition before close 1.5 hours', async () => {
        await syncDatabase([getMockEvent({
            eventTime: [
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
                eventTime: [
                    [mskMoment('2020-01-01 15:00'), mskMoment('2020-01-01 20:00')]
                ],
                anytime: false,
                rating: 5
            }),
            getMockEvent({
                title: 'AUX',
                eventTime: [
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
        const range = [mskMoment('2020-01-01 00:00'), mskMoment('2020-01-01 23:59')]
        const events = await findTopEventsInRange('theaters', range, 2)
        expect(events.map(e => e.title)).toEqual(['2. BEST', '3. BETTER'])
    })
})

describe('Search intervals', () => {

    freshDb()

    describe('SINGLE_INTERVAL [restriction]', () => {
        beforeAll(async () => {
            await cleanDb()
            await syncDatabase([getMockEvent({
                eventTime: [
                    mskMoment('2020-01-02 15:00')
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
                eventTime: [[
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

