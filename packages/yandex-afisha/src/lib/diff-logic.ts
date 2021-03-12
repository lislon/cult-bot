import { EventsSyncDiff, ParsedEventToSave } from '../database/parsed-event'

function isPeriodic(e: ParsedEventToSave): boolean {
    const ed = e.primaryData.timetable
    if (ed.length > 30) {
        return true
    }
    return false
}

export function filterOnlyRealChange(diff: EventsSyncDiff): EventsSyncDiff {
    return {
        ...diff,
        updated: diff.updated.filter(d => !isPeriodic(d)),
    }
}