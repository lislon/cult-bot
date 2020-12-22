import { EventInPackExcel, EventPackExcel, fetchAndParsePacks, saveValidationErrors } from './parserSpredsheetPacks'
import { Dictionary } from 'lodash'
import { sheets_v4 } from 'googleapis'
import { ExtIdAndId, ExtIdAndMaybeId } from '../interfaces/app-interfaces'
import { EventPackForSave } from '../database/db-packs'


export interface EventPackForSavePrepared {
    title: string
    description: string
    author: string
    events: ExtIdAndMaybeId[]
    weight: number
}

export interface EventPackValidated {
    published: boolean
    pack: EventPackForSavePrepared
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

async function processPack(p: EventPackExcel, idByExtId: Dictionary<ExtIdAndMaybeId>): Promise<EventPackValidated> {
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

    return {
        published: p.isPublish,
        raw: p,
        pack: {
            title: p.title,
            events: p.events.map(e => idByExtId[e.extId]).filter(Boolean),
            author: p.author,
            description: p.description,
            weight: p.weight,
        },
        errors,
        isValid: errors.title === undefined && errors.description === undefined && errors.badEvents.length == 0 && errors.imageUrl === undefined
    }
}

export function eventPacksEnrichWithids(eventPacks: EventPackForSavePrepared[], idByExtId: Dictionary<ExtIdAndId>): EventPackForSave[] {
    return eventPacks.map(pack => {
        return {
            title: pack.title,
            weight: pack.weight,
            author: pack.author,
            description: pack.description,
            eventIds: pack.events.map(({ extId }) => idByExtId[extId].id)
        }
    })
}

export async function prepareForPacksSync(excel: sheets_v4.Sheets, idByExtId: Dictionary<ExtIdAndMaybeId>): Promise<EventPackValidated[]> {
    const packsSyncResult = await fetchAndParsePacks(excel)
    const validationResult = await Promise.all(packsSyncResult.packs.map(p => processPack(p, idByExtId)))
    await saveValidationErrors(excel, validationResult)
    return validationResult
}

export function getOnlyValid(all: EventPackValidated[]): EventPackForSavePrepared[] {
    return all.filter(vr => vr.isValid && vr.published).map(vr => vr.pack)
}

