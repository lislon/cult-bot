import { ParsedEvent, ParsedEventToSave } from '../database/parsed-event'
import { db } from '../database/db'
import { EventTimetable, parseTimetable, predictIntervals } from '@culthub/timetable'
import { UniversalSyncDiff, WithId } from '@culthub/universal-db-sync'
import { DeletedColumns, DiffReport, ParsedEventField } from '../interfaces'
import { isEqual, sortBy } from 'lodash'

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
        .filter(key => key !== 'timetable' && key !== 'updatedAt') as unknown as ParsedEventField[]

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
    return differentFields
}

export async function prepareDiffReport(diff: UniversalSyncDiff<ParsedEventToSave, DeletedColumns>): Promise<DiffReport> {
    const existingEvents = await db.repoSync.loadEventsByIds(diff.updated.map(e => e.primaryData.id))

    return {
        inserted: sortBy(diff.inserted, [e => e.primaryData.category, e => e.primaryData.title]),
        deleted: sortBy(diff.deleted, [e => e.old.category, e => e.old.title]),
        updated: sortBy(diff.updated, [e => e.primaryData.category, e => e.primaryData.title])
            .map(d => {
                return {...d, diffFields: getFieldsWithDiffs(d, existingEvents)}
            })
            .filter(({diffFields}) => diffFields.length > 0),
        notChangedCount: diff.notChanged.length
    }
}