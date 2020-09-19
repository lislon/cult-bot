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
    beforeAll(async () => {
        await cleanDb()
        await syncDatabase([getMockEvent([
            [mskMoment('2020-01-02 15:00')]
        ], 'theaters')])
    })

    test('single event', async () => {
        const range = [mskMoment('2020-01-01 15:00'), mskMoment('2020-01-03 15:00')]
        const top = await findTopEventsInRange('theaters', range)
        expect(top.length).toEqual(1)
    })
})

describe('Search intervals', () => {

    describe('SINGLE_INTERVAL [restriction]', () => {
        beforeAll(async () => {
            await cleanDb()
            await syncDatabase([getMockEvent([
                [mskMoment('2020-01-02 15:00')]
            ])])
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
            await syncDatabase([getMockEvent([[
                mskMoment('2020-01-01 12:00'),
                mskMoment('2020-01-01 18:00')],
            ])])
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