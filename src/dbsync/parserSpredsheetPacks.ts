import { BotDb } from '../database/db'
import { sheets_v4 } from 'googleapis'
import { logger } from '../util/logger'
import { loadExcel } from './googlesheets'
import { EXCEL_COLUMN_NAMES, ExcelColumnName, ExcelRowResult, processExcelRow } from './parseSheetRow'
import { botConfig } from '../util/bot-config'
import { WrongExcelColumnsError } from './WrongFormatException'
import { ExcelUpdater } from './ExcelUpdater'
import Sheets = sheets_v4.Sheets
import { DateRange } from '../lib/timetable/intervals'

export async function runFetchAndParsePacks(db: BotDb): Promise<ExcelPacksSyncResult> {
    logger.debug('Connection from excel...')
    try {
        const excel: Sheets = await loadExcel()
        return fetchAndParsePacks(db, excel)
    } catch (e) {
        logger.error(e);
        throw e;
    }
}

export interface EventInPack {
    title: string
    rowNumber: number
    extId: string
}

export interface EventPack {
    title: string
    description: string
    author: string
    date_range: DateRange
    events: EventInPack[]
    isPublish: boolean
}

interface ExcelPacksSyncResult {
    packs: EventPack[]
}

const PACKS_SHEET_NAME = 'Подборки'

function getEventExtId(rowValue: string) {
    const match = rowValue.match(/^\[(.\d+.?)\]/)
    if (match) return match[1]
}

async function fetchAndParsePacks(db: BotDb, excel: Sheets): Promise<ExcelPacksSyncResult> {
    const syncResult: ExcelPacksSyncResult = {
        packs: []
    }

    const range = `${PACKS_SHEET_NAME}!A1:AA`;

    logger.debug(`Loading from excel [${range}]...`)

    const [sheetsMetaData, sheetsData] = await Promise.all([
        excel.spreadsheets.get({ spreadsheetId: botConfig.GOOGLE_DOCS_ID, ranges: [range] }),
        excel.spreadsheets.values.get({ spreadsheetId: botConfig.GOOGLE_DOCS_ID, range: range, valueRenderOption: 'FORMULA' })
    ]);

    const excelUpdater = new ExcelUpdater(excel)

    let currentPack: EventPack = undefined

    let rowNumber = 0;
    for (const [rowLabel, rowValue] of sheetsData.data.values) {
        if (rowLabel === 'Название') {
            if (currentPack !== undefined) {
                syncResult.packs.push(currentPack)
            }
            currentPack = {
                title: rowValue,
                events: [],
                description: '',
                author: '',
                isPublish: false,
                date_range: ['', '']
            }
        } else if (rowLabel === 'Опубликована') {
            currentPack.isPublish = !!(rowValue as string).match(/(YES|да|TRUE)/ig)
        } else if (rowLabel === 'Куратор') {
            currentPack.author = rowValue
        } else if (rowLabel === 'Описание') {
            currentPack.description = rowValue
        } else if (rowValue !== undefined && getEventExtId(rowValue) !== undefined) {
            currentPack.events.push({
                extId: getEventExtId(rowValue),
                rowNumber,
                title: rowValue
            })
        }
        rowNumber++
    }
    syncResult.packs.push(currentPack)

    return syncResult;
}