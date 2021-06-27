import { ParsedEventToSave } from '../database/parsed-event'

export function filterOnlyBotSpecificEvents(allEvents: ParsedEventToSave[]): ParsedEventToSave[] {
    return allEvents.filter(e => e.primaryData.category !== 'Квест')
}