import imageType = require('image-type')
import { EventPackForSave } from '../database/db-packs'
import {
    EventInPackExcel,
    EventPackExcel,
    ExcelPacksSyncResult,
    fetchAndParsePacks,
    saveValidationErrors
} from './parserSpredsheetPacks'
import { compact, Dictionary, keyBy } from 'lodash'
import { db } from '../database/db'
import { logger } from '../util/logger'
import fetch from 'node-fetch'
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

async function downloadImage(url: string): Promise<Buffer> {
    if (!url) {
        return Buffer.from('')
    }
    logger.debug(`Downloading '${url}'...`)
    const response = await fetch(url);
    const buffer = await response.buffer();

    if (!imageType(buffer)) {
        throw Error(`По ссылке '${url}' ожидалось изображение (jpg/png/gif), но получили что-то непонятное размером ${buffer.length} байт`)
    }

    return buffer
}

async function processPack(p: EventPackExcel, listOfLoadedImages: string[], idByExtId: Dictionary<{ id: number }>): Promise<EventPackValidated> {
    const errors: EventPackValidated['errors'] = {
        imageUrl: undefined,
        title: undefined,
        description: undefined,
        badEvents: []
    }
    let image: Buffer = undefined
    let imageSrc = ''
    if (p.imageSrc !== '') {
        try {
            image = listOfLoadedImages.includes(p.imageSrc) ? undefined : await downloadImage(p.imageSrc)
            imageSrc = p.imageSrc
        } catch (e) {
            errors.imageUrl = e.toString()
            logger.warn(e)
        }
    }

    errors.badEvents = p.events
        .filter(({extId}) => idByExtId[extId] === undefined)
        .map(raw => {
            return {
                rawEvent: raw,
                error: `Событие '${raw.extId}' не найдено в боте или оно не валидное`
            }
        })

    const eventIds = compact(p.events.map(e => idByExtId[e.extId])).map(e => e.id)
    return {
        published: p.isPublish,
        raw: p,
        pack: {
            title: p.title,
            imageSrc: imageSrc,
            image: imageSrc ? image : undefined,
            eventIds: eventIds,
            author: p.author,
            description: p.description,
            weight: p.weight,
        },
        errors,
        isValid: errors.title === undefined && errors.description === undefined && errors.badEvents.length == 0 && errors.imageUrl === undefined
    }
}

async function convertAndValidatePacks(packsSyncResult: ExcelPacksSyncResult, listOfLoadedImages: string[]): Promise<EventPackValidated[]> {

    const eventsExtIds = packsSyncResult.packs.flatMap(p => p.events.map(e => e.extId))
    const idByExtId = keyBy(await db.repoPacks.fetchIdsByExtIds(eventsExtIds), 'extId')

    return await Promise.all(packsSyncResult.packs.map(p => processPack(p, listOfLoadedImages, idByExtId)))
}

export async function prepareForPacksSync(excel: sheets_v4.Sheets): Promise<EventPackValidated[]> {
    const packsSyncResult = await fetchAndParsePacks(excel)
    const loadedImages = await db.repoPacks.fetchAlreadyLoadedImages()
    const validationResult = await convertAndValidatePacks(packsSyncResult, loadedImages)

    await saveValidationErrors(excel, validationResult)
    return validationResult
}

export function getOnlyValid(all: EventPackValidated[]): EventPackForSave[] {
    return all.filter(vr => vr.isValid && vr.published).map(vr => vr.pack)
}

