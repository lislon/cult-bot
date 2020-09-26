import { EventCategory } from '../../interfaces/app-interfaces'
import { findTopEventsInRange } from '../../db/events'
import { getNextWeekEndRange } from '../shared/shared-logic'

export async function getTopEvents(cat: EventCategory) {
    const range = getNextWeekEndRange()
    const events = await findTopEventsInRange(cat, range);
    return {range, events}
}
