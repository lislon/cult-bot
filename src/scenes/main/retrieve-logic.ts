import { EventCategory } from '../../interfaces/app-interfaces'
import { getNextWeekEndRange } from '../shared/shared-logic'
import { db } from '../../db'

export async function getTopEvents(cat: EventCategory) {
    const range = getNextWeekEndRange()
    const events = await db.repoTopEvents.findTopEventsInRange(cat, range);
    return {range, events}
}
