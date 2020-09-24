import { db, dbCfg, pgp } from '../../../src/db'
import { MomentIntervals } from '../../../src/lib/timetable/intervals'
import { EventCategory } from '../../../src/interfaces/app-interfaces'
import { EventToSave } from '../../../src/interfaces/db-interfaces'
import { listAllEventTags } from '../../../src/dbsync/parseSheetRow'


export async function cleanDb() {
    await db.none('DELETE FROM cb_events')
    await db.none('DELETE FROM cb_tags')
}

export function initializeDbTests() {
    afterAll(async () => {
        pgp.end()
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
    timeIntervals: MomentIntervals
    category: EventCategory
    tag_level_1: string
    rating: number
    anytime: boolean
}

export function getMockEvent(
    {
        timeIntervals = [],
        title = 'Event title',
        category = 'theaters',
        tag_level_1 = '',
        rating = 5,
        anytime = false
    }: Partial<MockEvent> = {}
): EventToSave {
    const event = {
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
        tag_level_2: '',
        tag_level_3: '',
        rating: rating,
        reviewer: '',
        geotag: ''
    }
    return {
        primaryData: event,
        timetable: {
            anytime: anytime
        },
        timeIntervals: timeIntervals,
        tags: listAllEventTags(event)
    }
}