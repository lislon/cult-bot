import { EventInPackExcel, EventPackExcel, ExcelPacksSyncResult } from './parserSpredsheetPacks'
import { countBy, Dictionary } from 'lodash'
import { ExtIdAndId, ExtIdAndMaybeId } from '../interfaces/app-interfaces'
import { PacksSyncDiff } from '../database/db-packs'
import { botConfig } from '../util/bot-config'


export interface EventPackForSavePrepared {
    title: string
    extId: string
    description: string
    author: string
    events: ExtIdAndMaybeId[]
    weight: number
    hideIfLessThen: number
}

export interface EventPackValidated {
    published: boolean
    pack: EventPackForSavePrepared
    raw: EventPackExcel
    errors: {
        title?: string
        liveness?: string
        weight?: string
        isPublish?: string
        description?: string
        extId?: string
        badEvents: BadEvent[]
    }
    isValid: boolean
}

interface BadEvent {
    rawEvent: EventInPackExcel,
    error: string
}

function parseLiveness(showUntil?: string): number | undefined {
    if (showUntil === undefined || showUntil.trim() === '') {
        return botConfig.DEFAULT_PACK_HIDE_WHEN_LESS_THEN_EVENTS
    }
    if (showUntil.toLowerCase().includes('послед')) {
        return 0
    }

    const digits = showUntil.replace(/[\D]/g, '')
    if (digits === '') {
        return undefined
    }
    return +digits
}

function processPack(p: EventPackExcel, idByExtId: Dictionary<ExtIdAndMaybeId>, packExtIds: Dictionary<number>): EventPackValidated {
    const errors: EventPackValidated['errors'] = {
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
    if (p.isPublish === undefined) {
        errors.isPublish = 'Пустое поле публиковать'
    }
    if (p.title === undefined) {
        errors.title = 'Пустое поле title'
    }
    if (p.weight === undefined || isNaN(p.weight)) {
        errors.weight = 'Пустое поле weight'
    }
    if (parseLiveness(p.liveness) === undefined) {
        errors.liveness = 'Неверно заполненное поле Живучесть'
    }

    if (packExtIds[p.extId] > 1) {
        errors.extId = `Есть подборка с таким же ID=${p.extId}`
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
            hideIfLessThen: parseLiveness(p.liveness)
        },
        errors,
        isValid: Object.values(errors).filter(e => typeof e === 'string').length === 0 && errors.badEvents.length == 0
    }
}

export function enrichPacksSyncDiffWithSavedEventIds(packsSync: PacksSyncDiff, idByExtId: Dictionary<ExtIdAndId>, unsavedPackEventIds: ExtIdAndMaybeId[]): void {
    [...packsSync.inserted, ...packsSync.recovered, ...packsSync.updated].forEach(pack => {
        pack.primaryData.eventIds = pack.primaryData.eventIds.map(id => {
            if (id > 0) {
                return id
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