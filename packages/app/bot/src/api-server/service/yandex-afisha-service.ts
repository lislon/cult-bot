import { FindMatchingEventRequest, FindMatchingEventResponse } from '@culthub/interfaces'
import { db } from '../../database/db'


export const findMatchingEvents = async (req: FindMatchingEventRequest): Promise<FindMatchingEventResponse> => {
    return {events: await db.repoEventsMatching.findMatchingEvents(req)}
}