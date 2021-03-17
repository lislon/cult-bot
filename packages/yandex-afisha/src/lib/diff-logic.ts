import { ParsedEvent, ParsedEventToSave } from '../database/parsed-event'
import { db } from '../database/db'
import { EventTimetable, parseTimetable, predictIntervals } from '@culthub/timetable'
import { UniversalSyncDiff, WithId } from '@culthub/universal-db-sync'
import { DeletedColumns } from '../interfaces'
import { isEqual } from 'lodash'

function parseTimetableOrThrow(input: string, now: Date): EventTimetable {
    const val = parseTimetable(input, now);
    if (val.status) {
        return val.value;
    }
    throw new Error(`Failed to parse ${input}: ${val.errors.join(', ')}`)
}

function isOnlyDateShifted(updatedEvent: WithId<ParsedEventToSave>, existingEvents: (ParsedEvent & { id: number })[]): boolean {
    const existingEvent = existingEvents.find(e => e.id === updatedEvent.primaryData.id)
    if (existingEvent === undefined) throw new Error(`wtf, not existing event id=${updatedEvent.primaryData.id}`)
    const now = new Date()
    const oldIntervals = predictIntervals(now, parseTimetableOrThrow(existingEvent.timetable, existingEvent.updatedAt || now), 90)
    const newIntervals = predictIntervals(now, parseTimetableOrThrow(existingEvent.timetable, existingEvent.updatedAt || now), 90)

    const compareByFields = Object.keys(updatedEvent.primaryData).filter(key => key !== 'timetable' && key !== 'updatedAt') as unknown as keyof ParsedEventToSave;

    const differentFields = [];
    for (const compareByField of compareByFields) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        if (!isEqual(updatedEvent.primaryData[compareByField], existingEvent[compareByField])) {
            differentFields.push(compareByField)
        }
    }
    const isTimetableSame = isEqual(oldIntervals, newIntervals)
    const isOtherFieldsSame = differentFields.length === 0
    return isOtherFieldsSame && isTimetableSame
}

export async function filterOnlyRealChange(diff: UniversalSyncDiff<ParsedEventToSave, DeletedColumns>): Promise<UniversalSyncDiff<ParsedEventToSave, DeletedColumns>> {
    const existingEvents = await db.repoSync.loadEventsByIds(diff.updated.map(e => e.primaryData.id))

    return {
        ...diff,
        updated: diff.updated
            // .filter(d => !isPeriodic(d))
            .filter(d => !isOnlyDateShifted(d, existingEvents))
        ,
    }
}