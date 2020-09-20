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
    beforeAll(async () => {
        expect(dbCfg.connectionString).toContain('test')
        await db.query('BEGIN')
        await cleanDb()
    })

    afterAll(async () => {
        await db.query('COMMIT')
        pgp.end()
    })
}

export interface MockEvent {
    timeIntervals: MomentIntervals
    category: EventCategory
    tag_level_1: string
}

export function getMockEvent(
    {
        timeIntervals = [],
        category = 'theaters',
        tag_level_1 = ''
    }: Partial<MockEvent> = {}
): EventToSave {
    const event = {
        category: category,
        publish: '',
        subcategory: '',
        title: 'Фейк',
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
        rating: 5,
        reviewer: '',
        geotag: ''
    }
    return {
        primaryData: event,
        timetable: {},
        timeIntervals: timeIntervals,
        tags: listAllEventTags(event)
    }
}