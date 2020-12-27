import { db } from '../../../src/database/db'
import { MomentIntervals } from '../../../src/lib/timetable/intervals'
import { Event, EventCategory, TagLevel2 } from '../../../src/interfaces/app-interfaces'
import { EventToSave } from '../../../src/interfaces/db-interfaces'
import { SyncDiff } from '../../../src/database/db-sync-repository'
import { EventPackForSave } from '../../../src/database/db-packs'

export async function cleanDb() {
    await db.none('TRUNCATE cb_events_entrance_times, cb_events, cb_events_packs RESTART identity')
}

export interface MockEvent {
    ext_id: string
    title: string
    eventTime: MomentIntervals
    category: EventCategory
    address: string
    tag_level_1: string[]
    tag_level_2: TagLevel2[]
    rating: number
    anytime: boolean
    order_rnd?: number
    reviewer: string
    dateDeleted?: Date
}

export interface MockPackForSave {
    title: string
    description: string
    author: string
    eventTitles: string[]
    weight: number
}


export function getMockEvent({
        ext_id = '',
        eventTime = [],
        title = 'Event title',
        category = 'theaters',
        address = '',
        tag_level_1 = [],
        tag_level_2 = [],
        rating = 5,
        anytime = false,
        order_rnd = undefined,
        reviewer = '',
        dateDeleted = undefined
    }: Partial<MockEvent> = {}
): EventToSave {
    const event: Event = {
        ext_id: ext_id,
        category: category,
        publish: '',
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
        reviewer: reviewer,
        geotag: ''
    }
    return {
        primaryData: event,
        timetable: {
            // anytime: anytime
        },
        timeIntervals: eventTime,
        is_anytime: anytime,
        order_rnd: order_rnd,
        dateDeleted: dateDeleted
    }
}

export function getMockPack({
                                title = 'Event title',
                                description = 'desc',
                                author = 'author',
                                weight = 0,
                                eventIds = [1],
                            }: Partial<EventPackForSave> = {}
): EventPackForSave {
    return {
        title,
        description,
        author,
        weight,
        eventIds,
    }
}


export function expectedTitles(titles: string[], events: Pick<Event, 'title'>[]) {
    expect(events.map(t => t.title).sort()).toEqual(titles.sort())
}

export function expectedTitlesStrict(titles: string[], events: Pick<Event, 'title'>[]) {
    expect(events.map(t => t.title)).toEqual(titles)
}

export async function syncEventsDb4Test(events: EventToSave[]): Promise<SyncDiff> {
    events.forEach((e, i) => {
        if (e.primaryData.ext_id === '') {
            e.primaryData.ext_id = 'TEST-' + i
        }
    })
    for (let i = 0; true; i++) {
        try {
            return await db.repoSync.syncDatabase(events)
        } catch (e) {

            const repeatCodes = {
                '40001': 'could not serialize access due to concurrent delete',
                '25P02': 'current transaction is aborted, commands ignored until end of transaction block'
            }

            console.log(e);

            if (Object.keys(repeatCodes).includes(e.code) && i <= 5) {
                // await sleep(3000 * Math.random())
            } else {
                throw e
            }

        }
    }
}

export async function syncPacksDb4Test(mockPacks: MockPackForSave[]): Promise<number[]> {
    return await db.task(async (dbTask) => {
        const tilesAndIds = await dbTask.many(`
            SELECT title, id
            FROM cb_events
            WHERE title IN ($(titles:csv)) AND deleted_at IS NULL`, {
            titles: mockPacks.flatMap(p => p.eventTitles)
        })

        const packs = mockPacks.map(p => {
            return {
                ...p,
                eventIds: p.eventTitles
                    .map(eventTitle => {
                        const eventId = tilesAndIds
                            .filter(tAndId => tAndId.title === eventTitle)
                        if (eventId.length === 0) {
                            throw new Error(`Cant find event by ${eventTitle}`)
                        }
                        if (eventId.length > 1) {
                            throw new Error(`More then 1 event with ${eventTitle}`)
                        }
                        return +eventId[0].id
                    }),
            }
        })

        return await db.repoPacks.sync(packs, dbTask)
    })
}

export function expectedPacksTitle(titles: string[], packs: any[]) {
    expect(packs.map(t => t.title)).toEqual(titles)
}