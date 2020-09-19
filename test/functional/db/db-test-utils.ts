import { db, dbCfg, pgp } from '../../../src/db'
import { MomentIntervals } from '../../../src/lib/timetable/intervals'
import { EventCategory } from '../../../src/interfaces/app-interfaces'
import { EventToSave } from '../../../src/interfaces/db-interfaces'


export async function cleanDb() {
    await db.none('DELETE FROM cb_events')
}

export function initializeDbTests() {
    beforeAll(async () => {
        expect(dbCfg.connectionString).toContain('test')
        await cleanDb()
    })

    afterAll(async () => {
        pgp.end()
    })
}

export function getMockEvent(timeIntervals: MomentIntervals, category: EventCategory = 'theaters'): EventToSave {
    return {
        primaryData: {
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
            tag_level_1: '',
            tag_level_2: '',
            tag_level_3: '',
            rating: 5,
            reviewer: ''
        },
        timetable: {
        },
        timeIntervals: timeIntervals
    }
}