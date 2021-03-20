import { ParsedEvent, ParsedEventToSave } from '../database/parsed-event'
import { db } from '../database/db'
import { EventTimetable, parseTimetable, predictIntervals } from '@culthub/timetable'
import { UniversalSyncDiff, WithId } from '@culthub/universal-db-sync'
import { DeletedColumns, DiffReport, ParsedEventField, WithBotExtId } from '../interfaces'
import { isEqual, sortBy } from 'lodash'
import { FindMatchingEventResponse } from '@culthub/interfaces'
import { Deleted } from '@culthub/universal-db-sync/src/universal-db-sync'

function parseTimetableOrThrow(input: string, now: Date): EventTimetable {
    const val = parseTimetable(input, now)
    if (val.status) {
        return val.value
    }
    throw new Error(`Failed to parse ${input}: ${val.errors.join(', ')}`)
}

function getFieldsWithDiffs(updatedEvent: WithId<ParsedEventToSave>, existingEvents: (ParsedEvent & { id: number })[]): ParsedEventField[] {
    const existingEvent = existingEvents.find(e => e.id === updatedEvent.primaryData.id)
    if (existingEvent === undefined) throw new Error(`wtf, not existing event id=${updatedEvent.primaryData.id}`)
    const now = new Date()
    const oldIntervals = predictIntervals(now, parseTimetableOrThrow(existingEvent.timetable, existingEvent.updatedAt || now), 90)
    const newIntervals = predictIntervals(now, parseTimetableOrThrow(existingEvent.timetable, existingEvent.updatedAt || now), 90)

    const compareByFields = Object.keys(updatedEvent.primaryData)
        .filter(key => key !== 'timetable' && key !== 'updatedAt' && key !== 'tags') as unknown as ParsedEventField[]

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

    function encrichWithBotEventIds<E extends { primaryData: { extId: string } }>(e: E): E & WithBotExtId {
        return {...e, botExtId: botExtIds.events.find(ee => ee.id === e.primaryData.extId)?.extIds?.join(',') };
    }


    return {
        inserted: sortBy(diff.inserted, [e => e.primaryData.category, e => e.primaryData.title]).map(encrichWithBotEventIds),
        deleted: sortBy(diff.deleted, [e => e.old.category, e => e.old.title]).map(encrichWithBotEventIds),
        updated: sortBy(diff.updated, [e => e.primaryData.category, e => e.primaryData.title])
            .map(d => {
                return {...d, diffFields: getFieldsWithDiffs(d, existingEvents)}
            })
            .filter(({diffFields}) => diffFields.length > 0)
            .map(encrichWithBotEventIds),
        notChangedCount: diff.notChanged.length
    }
}