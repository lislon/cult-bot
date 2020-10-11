import { Event, EventCategory } from '../../interfaces/app-interfaces'
import { getNextWeekEndRange, limitEventsToPage } from '../shared/shared-logic'
import { db } from '../../db'
import { Moment } from 'moment'

export async function getTopEvents(cat: EventCategory, offset: number = 0): Promise<{range: [Moment, Moment], events: Event[]}> {
    const range = getNextWeekEndRange()
    const events = await db.repoTopEvents.getTop(cat, range, limitEventsToPage, offset);
    return {range, events}
}
