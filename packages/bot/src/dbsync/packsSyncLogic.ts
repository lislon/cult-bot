import {
    EventInPackExcel,
    EventPackExcel,
    ExcelPacksSyncResult,
    fetchAndParsePacks,
    savePacksValidationErrors
} from './parserSpredsheetPacks'
import { countBy, Dictionary } from 'lodash'
import { sheets_v4 } from 'googleapis'
import { ExtIdAndId, ExtIdAndMaybeId } from '../interfaces/app-interfaces'
import { PacksSyncDiff } from '../database/db-packs'


export interface EventPackForSavePrepared {
    title: string
    extId: string
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
        title: string
        weight: string
        description: string
        extId: string
        badEvents: BadEvent[]
    }
    isValid: boolean
}

interface BadEvent {
    rawEvent: EventInPackExcel,
    error: string
}

function processPack(p: EventPackExcel, idByExtId: Dictionary<ExtIdAndMaybeId>, packExtIds: Dictionary<number>): EventPackValidated {
    const errors: EventPackValidated['errors'] = {
        title: undefined,
        weight: undefined,
        description: undefined,
        extId: undefined,
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
    if (p.description === undefined) {
        errors.description = 'Пустое поле description'
    }
    if (p.title === undefined) {
        errors.title = 'Пустое поле title'
    }
    if (p.weight === undefined || isNaN(p.weight)) {
        errors.weight = 'Пустое поле weight'
    }
    if (packExtIds[p.extId] > 1) {
        errors.extId = 'Есть событие с таким же ID'
    }

    return {
        published: p.isPublish,
        raw: p,
        pack: {
            title: p.title,
            extId: p.extId,
            events: p.events.map(e => idByExtId[e.extId]).filter(Boolean),
            author: p.author,
            description: p.description,
            weight: p.weight,
        },
        errors,
        isValid: errors.title === undefined && errors.description === undefined && errors.badEvents.length == 0 && errors.weight === undefined
    }
}

export function enrichPacksSyncDiffWithSavedEventIds(packsSync: PacksSyncDiff, idByExtId: Dictionary<ExtIdAndId>, unsavedPackEventIds: ExtIdAndMaybeId[]): void {
    [...packsSync.inserted, ...packsSync.recovered, ...packsSync.updated].forEach(pack => {
        pack.primaryData.eventIds = pack.primaryData.eventIds.map(id => {
            if (id > 0) {
                return id;
            } else {
                const extId = unsavedPackEventIds[-id - 1].extId
                return idByExtId[extId].id
            }
        })
    })
}

export async function validatePacksForSync(packsSyncResult: ExcelPacksSyncResult, idByExtId: Dictionary<ExtIdAndMaybeId>): Promise<EventPackValidated[]> {

    const countByExtId = countBy(packsSyncResult.packs, p => p.extId)
    const validationResult = packsSyncResult.packs.map(p => processPack(p, idByExtId, countByExtId))
    return validationResult
}

export function getOnlyValid(all: EventPackValidated[]): EventPackForSavePrepared[] {
    return all.filter(vr => vr.isValid && vr.published).map(vr => vr.pack)
}

