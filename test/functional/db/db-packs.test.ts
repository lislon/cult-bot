import { cleanDb, expectedTitles, getMockEvent, syncDatabase4Test } from './db-test-utils'
import { db, dbCfg } from '../../../src/database/db'
import { mkInterval } from '../../lib/timetable/test-utils'
import { mskMoment } from '../../../src/util/moment-msk'
import { EventPackForSave } from '../../../src/database/db-packs'

beforeAll(() => dbCfg.connectionString.includes('test') || process.exit(666))
afterAll(db.$pool.end);

function sampleImage() {
    return Buffer.from('data:image/png;base64,iVBORw0KGgoAAA\n' +
        'ANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4\n' +
        '//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU\n' +
        '5ErkJggg==', 'base64')
}

export function expectedPacksTitle(titles: string[], packs: any[]) {
    expect(packs.map(t => t.title)).toEqual(titles)
}

export function makePack({
                             title = 'Event title',
                             description = 'desc',
                             author = 'author',
                             weight = 0,
                             eventIds = [1],
                             imageSrc = '',
                             image = undefined,
                         }: Partial<EventPackForSave> = {}
): EventPackForSave {
    return {
        title,
        description,
        author,
        weight,
        eventIds,
        imageSrc,
        image
    }
}

describe('Packs', () => {
    const eventTime = [mskMoment('2020-01-01 12:00'), mskMoment('2020-01-03 15:00')]
    const eventTimeOutRange = [mskMoment('2022-01-01 12:00'), mskMoment('2022-01-03 15:00')]
    const yearRange = mkInterval('[2020-01-01 00:00, 2021-01-02 00:00)')

    beforeEach(async () => {
        await cleanDb()
    })

    test('sync packs', async () => {
        await db.repoPacks.sync([makePack({title: 'A', image: sampleImage()})])
    })

    test('packs will be filtered by date', async () => {
        const diff = await syncDatabase4Test([
            getMockEvent({title: 'A', eventTime}),
            getMockEvent({title: 'B', eventTime: eventTimeOutRange}),
        ])
        const [aId, bId] = diff.insertedEvents.map(e => e.primaryData.id)

        await db.repoPacks.sync([
            makePack({ title: 'A pack', eventIds: [ aId ] }),
            makePack({ title: 'B back', eventIds: [ bId ] })
        ])
        const list = await db.repoPacks.listPacks({interval: yearRange})
        expectedPacksTitle(['A pack'], list)
    })

    test('events in packs will be sorted', async () => {

        const day1 = [mskMoment('2020-01-01 12:00')]
        const day2 = [mskMoment('2020-01-02 12:00')]
        const day3 = [mskMoment('2020-01-03 12:00')]

        const diff = await syncDatabase4Test([
            getMockEvent({title: 'B', eventTime: day2}),
            getMockEvent({title: 'E', eventTime: day2, anytime: true, rating: 10}),
            getMockEvent({title: 'D', eventTime: day2, anytime: true, rating: 5}),
            getMockEvent({title: 'A', eventTime: day1}),
            getMockEvent({title: 'C', eventTime: day3}),
        ])

        await db.repoPacks.sync([
            makePack({ title: 'A pack', eventIds: diff.insertedEvents.map(e => e.primaryData.id) }),
        ])

        const events = await db.repoPacks.listPacks({ interval: yearRange })
        expectedTitles(['A', 'B', 'C', 'D', 'E'], events[0].events)
    })

})