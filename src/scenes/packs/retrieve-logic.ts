import { Event, EventCategory, MyInterval } from '../../interfaces/app-interfaces'
import { getNextWeekEndRange, limitEventsToPage } from '../shared/shared-logic'
import { db } from '../../db'

export async function getTopEvents(cat: EventCategory, fromDate: Date, offset: number = 0): Promise<{range: MyInterval, events: Event[]}> {
    const range = getNextWeekEndRange(fromDate)
    const events = await db.repoTopEvents.getTop(cat, range, limitEventsToPage, offset);
    return {range, events}
}
