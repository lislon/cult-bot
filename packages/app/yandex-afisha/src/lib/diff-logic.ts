import { ParsedEvent, ParsedEventToSave } from '../database/parsed-event'
import { db } from '../database/db'
import { EventTimetable, parseTimetable, predictIntervals } from '@culthub/timetable'
import { UniversalSyncDiff, WithId } from '@culthub/universal-db-sync'
import { DeletedColumns, DiffReport, ParsedEventField } from '../interfaces'
import { isEqual, sortBy } from 'lodash'
import { FindMatchingEventResponse } from '@culthub/interfaces'
import { encrichWithBotEventIds } from './cron-common'

function parseTimetableOrThrow(input: string, now: Date): EventTimetable {
    const val = parseTimetable(input, now)
    if (val.status) {
        return val.value
    }
    throw new Error(`Failed to parse ${input}: ${val.errors.join(', ')}`)
}

function getFieldsWithDiffs(updatedEvent: WithId<ParsedEventToSave>, existingEvent: (ParsedEvent & { id: number })): ParsedEventField[] {
    const now = new Date()
    const oldIntervals = predictIntervals(now, parseTimetableOrThrow(existingEvent.timetable, existingEvent.updatedAt || now), 90)
    const newIntervals = predictIntervals(now, parseTimetableOrThrow(existingEvent.timetable, existingEvent.updatedAt || now), 90)

    const compareByFields = Object.keys(updatedEvent.primaryData)
        .filter(key => key !== 'timetable' && key !== 'updatedAt' && key !== 'tags' && key !== 'place') as unknown as ParsedEventField[]

    const differentFields: ParsedEventField[] = []
    for (const compareByField of compareByFields) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        if (!isEqual(updatedEvent.primaryData[compareByField], existingEvent[compareByField])) {
            differentFields.push(compareByField)
        }
    }
    const isTimetableSame = isEqual(oldIntervals, newIntervals)
    if (!isTimetableSame) {
        differentFields.push('timetable')
    }

    if (!isEqual(updatedEvent.primaryData.tags.sort(), existingEvent.tags.sort())) {
        differentFields.push('tags')
    }

    return differentFields
}

export async function prepareDiffReport(diff: UniversalSyncDiff<ParsedEventToSave, DeletedColumns>, botExtIds: FindMatchingEventResponse): Promise<DiffReport> {
    const existingEvents = await db.repoSync.loadEventsByIds(diff.updated.map(e => e.primaryData.id))


    return {
        inserted: sortBy(diff.inserted, [e => e.primaryData.category, e => e.primaryData.title])
            .map(e => encrichWithBotEventIds(e, botExtIds)),
        deleted: sortBy(diff.deleted, [e => e.old.category, e => e.old.title])
            .map(e => encrichWithBotEventIds(e, botExtIds)),
        updated: sortBy(diff.updated, [e => e.primaryData.category, e => e.primaryData.title])
            .map(d => {
                const oldEvent = existingEvents.find(e => e.id === d.primaryData.id)
                if (oldEvent === undefined) throw new Error(`Old event with = ${d.primaryData.id} not found`)
                return {
                    ...d,
                    diffFields: getFieldsWithDiffs(d, oldEvent),
                    old: oldEvent
                }
            })
            .filter(({diffFields}) => diffFields.length > 0)
            .map(e => encrichWithBotEventIds(e, botExtIds)),
        notChangedCount: diff.notChanged.length
    }
}