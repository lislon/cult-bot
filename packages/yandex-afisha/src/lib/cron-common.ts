import { addDays, startOfDay, startOfISOWeek } from 'date-fns/fp'
import flow from 'lodash/fp/flow'
import { FindMatchingEventResponse } from '@culthub/interfaces'
import { WithBotExtId } from '../interfaces'

export function getNextWeekendDates(now: Date): Date[] {
    return [flow(startOfISOWeek, startOfDay, addDays(5))(now), flow(startOfISOWeek, startOfDay, addDays(6))(now)]
}

type WithExtId = { primaryData: { extId: string } }

export function encrichWithBotEventIds<E extends WithExtId>(e: E, encrichWithBotEventIds: FindMatchingEventResponse): E & WithBotExtId {
    return {...e, botExtId: encrichWithBotEventIds.events.find(ee => ee.id === e.primaryData.extId)?.extIds?.join(',')}
}