import { db } from '../../database/db'
import { FindMatchingEventRequest, FindMatchingEventResponse } from '@culthub/interfaces'

export const findMatchingEvents = async (req: FindMatchingEventRequest): Promise<FindMatchingEventResponse> => {
    return { events: await db.repoEventsMatching.findMatchingEvents(req) }
}