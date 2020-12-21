import { EventPackForSave } from '../database/db-packs'
import { EventInPackExcel, EventPackExcel, fetchAndParsePacks, saveValidationErrors } from './parserSpredsheetPacks'
import { Dictionary, keyBy } from 'lodash'
import { db } from '../database/db'
import { sheets_v4 } from 'googleapis'

export interface EventPackValidated {
    published: boolean
    pack: EventPackForSave
    raw: EventPackExcel
    errors: {
        imageUrl: string
        title: string
        description: string
        badEvents: BadEvent[]
    }
    isValid: boolean
}

interface BadEvent {
    rawEvent: EventInPackExcel,
    error: string
}

async function processPack(p: EventPackExcel, idByExtId: Dictionary<{ id: number }>): Promise<EventPackValidated> {
    const errors: EventPackValidated['errors'] = {
        imageUrl: undefined,
        title: undefined,
        description: undefined,
        badEvents: []
    }

    errors.badEvents = p.events
        .filter(({extId}) => idByExtId[extId] === undefined)
        .map(raw => {
            return {
                rawEvent: raw,
                error: `Событие '${raw.extId}' не найдено в боте или оно не валидное`
            }
        })

    const eventIds = p.events.map(e => idByExtId[e.extId]).filter(Boolean).map(e => e.id)
    return {
        published: p.isPublish,
        raw: p,
        pack: {
            title: p.title,
            eventIds: eventIds,
            author: p.author,
            description: p.description,
            weight: p.weight,
        },
        errors,
        isValid: errors.title === undefined && errors.description === undefined && errors.badEvents.length == 0 && errors.imageUrl === undefined
    }
}


export async function prepareForPacksSync(excel: sheets_v4.Sheets): Promise<EventPackValidated[]> {
    const packsSyncResult = await fetchAndParsePacks(excel)

    const existingIds = await db.repoPacks.fetchAllIdsExtIds()

    const idByExtId: Dictionary<{ id: number }> = keyBy(existingIds, 'extId')

    const validationResult = await Promise.all(packsSyncResult.packs.map(p => processPack(p, idByExtId)))


    await saveValidationErrors(excel, validationResult)
    return validationResult
}

export function getOnlyValid(all: EventPackValidated[]): EventPackForSave[] {
    return all.filter(vr => vr.isValid && vr.published).map(vr => vr.pack)
}

