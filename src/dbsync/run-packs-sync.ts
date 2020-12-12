import { db, pgp } from '../database/db'
import {
    EventInPackExcel,
    EventPackExcel,
    ExcelPacksSyncResult,
    fetchAndParsePacks,
    saveValidationErrors
} from './parserSpredsheetPacks'
import { EventPackForSave } from '../database/db-packs'
import request from 'request-promise'
import { compact, Dictionary, keyBy } from 'lodash'
import { logger } from '../util/logger'
import { authToExcel } from './googlesheets'
import { sheets_v4 } from 'googleapis'
import Sheets = sheets_v4.Sheets

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
    return Buffer.from(await request(url, {
        encoding: undefined,
        followRedirect: true
    }))
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
        .filter(( { extId }) => idByExtId[extId] === undefined)
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
            imageSrc: imageSrc,
            image: image,
            eventIds: compact(p.events.map(e => idByExtId[e.extId])).map(e => e.id),
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

(async function run() {
    logger.debug('Connection from excel...')
    try {
        const excel: Sheets = await authToExcel()
        const packsSyncResult = await fetchAndParsePacks(excel)
        const loadedImages = await db.repoPacks.fetchLoadedImages()
        const validationResult = await convertAndValidatePacks(packsSyncResult, loadedImages)

        await saveValidationErrors(excel, validationResult)

        await db.repoPacks.sync(validationResult.filter(vr => vr.isValid).map(vr => vr.pack))
    } catch (e) {
        logger.error(e);
    }
    // console.log(q.errorsUnresolved)
    pgp.end()
})()

