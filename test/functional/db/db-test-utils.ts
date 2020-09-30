import { db } from '../../../src/db'
import { MomentIntervals } from '../../../src/lib/timetable/intervals'
import { Event, EventCategory, TagLevel2 } from '../../../src/interfaces/app-interfaces'
import { EventToSave } from '../../../src/interfaces/db-interfaces'
import { syncDatabase } from '../../../src/db/sync'


export async function cleanDb() {
    await db.none('DELETE FROM cb_events')
}

export function initializeDbTests() {
    // beforeAll(async (done) => {
    //     expect(dbCfg.connectionString).toContain('test')
    //     console.log('before all')
    //     await db.result('SET SESSION CHARACTERISTICS AS TRANSACTION ISOLATION LEVEL SERIALIZABLE READ WRITE')
    //     done()
    // })


}

export interface MockEvent {
    title: string,
    eventTime: MomentIntervals
    category: EventCategory
    address: string
    tag_level_1: string[]
    tag_level_2: TagLevel2[]
    rating: number
    anytime: boolean
}

export function getMockEvent(
    {
        eventTime = [],
        title = 'Event title',
        category = 'theaters',
        address = '',
        tag_level_1 = [],
        tag_level_2 = [],
        rating = 5,
        anytime = false
    }: Partial<MockEvent> = {}
): EventToSave {
    const event: Event = {
        category: category,
        publish: '',
        subcategory: '',
        title: title,
        place: '',
        address: address,
        timetable: 'пн-вт: 15:00-18:00',
        duration: '',
        price: '',
        notes: '',
        description: '',
        url: '',
        tag_level_1: tag_level_1,
        tag_level_2: tag_level_2,
        tag_level_3: [],
        rating: rating,
        reviewer: '',
        geotag: ''
    }
    return {
        primaryData: event,
        timetable: {
            anytime: anytime
        },
        timeIntervals: eventTime
    }
}

export function expectedTitles(titles: string[], events: Event[]) {
    expect(events.map(t => t.title)).toEqual(expect.arrayContaining(titles))
}

export function expectedTitlesStrict(titles: string[], events: Event[]) {
    expect(events.map(t => t.title)).toEqual(titles)
}

export async function syncDatabase4Test(events: EventToSave[]) {
    for (let i = 0; true; i++) {
        try {
            return await syncDatabase(events)
        } catch (e) {

            const repeatCodes = {
                '40001': 'could not serialize access due to concurrent delete',
                '25P02': 'current transaction is aborted, commands ignored until end of transaction block'
            }

            console.log('opsik ' + i + ' ' + e.code);
            console.log(e);

            if (Object.keys(repeatCodes).includes(e.code) && i <= 5) {
                // await sleep(3000 * Math.random())
            } else {
                throw e
            }

        }
    }
}

