import { sheets_v4 } from 'googleapis'
import { logger } from '../util/logger'
import { botConfig } from '../util/bot-config'
import { ExcelUpdater } from '@culthub/google-docs'
import { EventPackValidated } from './packsSyncLogic'
import Sheets = sheets_v4.Sheets

const EXCEL_COLUMNS_PACKS = {
    keys: '',
    values: '',
}

const VERTICAL_ORDER = {
    title: 'Название',
    id: 'ID',
    isPublish: 'Опубликована:',
    author: 'Куратор',
    description: 'Описание',
    weight: 'Вес',
    events: 'События'
} as const

export interface EventInPackExcel {
    title: string
    rowNumber: number
    extId: string
}

export interface EventPackExcel {
    title: string
    extId: string
    description: string
    author: string
    events: EventInPackExcel[]
    isPublish: boolean
    weight: number
    sheetId: number
    rowNumber: number
}

export interface ExcelPacksSyncResult {
    packs: EventPackExcel[]
}

const PACKS_SHEET_NAME = 'Подборки'

function getEventExtId(rowValue?: string | number) {
    if (typeof rowValue === 'string') {
        const match = rowValue?.match(/^(.\d+[A-Z]?)(\s+|$)/)
        if (match) return match[1]
    }
}

export async function savePacksValidationErrors(excel: Sheets, allValidatedEvents: EventPackValidated[]): Promise<void> {
    const excelUpdater = new ExcelUpdater(excel, EXCEL_COLUMNS_PACKS)


    allValidatedEvents.forEach(({raw, errors}, index) => {


        function markRow(rowName: keyof typeof VERTICAL_ORDER, errorText: string) {
            const rowNumber = raw.rowNumber + Object.keys(VERTICAL_ORDER).indexOf(rowName)
            excelUpdater.colorCell(raw.sheetId, 'values', rowNumber, 'red')
            excelUpdater.annotateCell(raw.sheetId, 'values', rowNumber, errorText)
        }

        const numberOfRowsTillNextPack = index === allValidatedEvents.length - 1 ? 25 : (allValidatedEvents[index + 1].raw.rowNumber - raw.rowNumber - 1)
        excelUpdater.clearColumnFormat(raw.sheetId, 'values', raw.rowNumber, numberOfRowsTillNextPack)

        errors.badEvents.forEach(({rawEvent, error}) => {
            excelUpdater.colorCell(raw.sheetId, 'values', rawEvent.rowNumber, 'red')
            excelUpdater.annotateCell(raw.sheetId, 'values', rawEvent.rowNumber, error)
        })
        if (errors.description) {
            markRow('description', errors.description)
        }
        if (errors.title) {
            markRow('title', errors.title)
        }
        if (errors.weight) {
            markRow('weight', errors.weight)
        }
        if (errors.extId) {
            markRow('id', errors.extId)
        }
    })

    await excelUpdater.update(botConfig.GOOGLE_DOCS_ID)
}

export async function fetchAndParsePacks(excel: Sheets): Promise<ExcelPacksSyncResult> {
    const packs: EventPackExcel[] = []

    const range = `${PACKS_SHEET_NAME}!A1:AA`

    logger.debug(`Loading from excel [${range}]...`)

    const [sheetsMetaData, sheetsData] = await Promise.all([
        excel.spreadsheets.get({spreadsheetId: botConfig.GOOGLE_DOCS_ID, ranges: [range]}),
        excel.spreadsheets.values.get({
            spreadsheetId: botConfig.GOOGLE_DOCS_ID,
            range: range,
            valueRenderOption: 'FORMULA'
        })
    ])

    // const excelUpdater = new ExcelUpdater(excel)

    let currentPack: EventPackExcel = undefined

    let rowNumber = 0
    for (const [rowLabel, rowValue] of sheetsData.data.values) {
        if (rowLabel === 'Название') {
            if (currentPack !== undefined) {
                packs.push(currentPack)
            }
            currentPack = {
                title: rowValue || undefined,
                extId: undefined,
                events: [],
                description: undefined,
                author: '',
                weight: 0,
                isPublish: undefined,
                rowNumber,
                sheetId: sheetsMetaData.data.sheets[0].properties.sheetId
            }
        } else if (rowLabel === 'Опубликована') {
            currentPack.isPublish = !!(rowValue as string).toLocaleLowerCase().match(/(yes|да|true)/)
        } else if (rowLabel === 'Куратор') {
            currentPack.author = rowValue
        } else if (rowLabel === 'Вес') {
            currentPack.weight = +rowValue
        } else if (rowLabel === 'Описание') {
            currentPack.description = rowValue
        } else if (rowLabel === 'ID') {
            currentPack.extId = '' + rowValue
        } else if (rowValue !== undefined && (rowLabel === 'События' || rowLabel === '') && currentPack !== undefined) {
            const extId = getEventExtId(rowValue)
            currentPack.events.push({
                extId: extId ?? rowValue,
                rowNumber,
                title: rowValue
            })
        }
        rowNumber++
    }
    packs.push(currentPack)

    return {
        packs,
    }
}
