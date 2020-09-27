import { db, dbCfg } from '../../../src/db'
import { MomentIntervals } from '../../../src/lib/timetable/intervals'
import { Event, EventCategory, TagLevel2 } from '../../../src/interfaces/app-interfaces'
import { EventToSave } from '../../../src/interfaces/db-interfaces'


export async function cleanDb() {
    await db.none('DELETE FROM cb_events')
}

export function initializeDbTests() {
    afterAll(async () => {
        db.$pool.end()
    })
}

export function freshDb() {
    beforeAll(async () => {
        expect(dbCfg.connectionString).toContain('test')
        await db.query('BEGIN')
        await cleanDb()
    })

    afterAll(async () => {
        await db.query('COMMIT')
    })
}


export interface MockEvent {
    title: string,
    eventTime: MomentIntervals
    category: EventCategory
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
        address: '',
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