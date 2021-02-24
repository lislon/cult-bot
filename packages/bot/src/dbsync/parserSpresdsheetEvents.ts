import { EventCategory } from '../interfaces/app-interfaces'
import {
    CAT_TO_SHEET_NAME,
    EXCEL_COLUMNS_EVENTS,
    ExcelColumnNameEvents,
    ExcelRowEvents,
    ExcelRowResult,
    ExcelSheetResult,
    processExcelRow
} from './parseSheetRow'
import { sheets_v4 } from 'googleapis'
import { rightDate } from '../lib/timetable/intervals'
import { EventToSave } from '../interfaces/db-interfaces'
import { WrongExcelColumnsError } from './WrongFormatException'
import { BotDb } from '../database/db'
import { isEqual, parseISO } from 'date-fns'
import { botConfig } from '../util/bot-config'
import { logger } from '../util/logger'
import { countBy, last } from 'lodash'
import { ExcelUpdater } from './ExcelUpdater'
import Sheets = sheets_v4.Sheets

export interface SpreadSheetValidationError {
    sheetTitle: string,
    extIds: string[]
}
export interface ExcelParseResult {
    errors: SpreadSheetValidationError[]
    rawEvents?: EventToSave[]
}

function getSheetCategory(sheetNo: number) {
    return Object.keys(CAT_TO_SHEET_NAME)[sheetNo] as EventCategory
}

function getExcelColumns() {
    return Object.keys(EXCEL_COLUMNS_EVENTS) as ExcelColumnNameEvents[]
}

function mapRowToColumnObject(row: string[]) {
    const keyValueRow: Partial<ExcelRowEvents> = {}
    row.forEach((val: string, index) => keyValueRow[(getExcelColumns())[index]] = val)
    return keyValueRow
}

function validateUnique(excelRows: ExcelRowResult[]) {
    const uniqueId = countBy(excelRows, (e) => e.data.extId)
    excelRows.forEach(row => {
        if (uniqueId[row.data.extId] !== 1) {
            row.errors.extId = [...row.errors.extId, 'ID не уникальный (глобально)']
            row.valid = false
        }
    })
}
const OLD_DATE = parseISO('1999-01-01T00:00:00Z')
const FUTURE_DATE = parseISO('3000-01-01 00:00:00')

function getDueDate(mapped: ExcelRowResult) {
    const lastEventDate = last(mapped.timeIntervals)
    if (lastEventDate === undefined) {
        return OLD_DATE
    } else if (mapped.timetable?.anytime) {
        return FUTURE_DATE
    } else {
        return rightDate(last(mapped.timeIntervals))
    }
}

export async function parseRawSheetsEventSpreedsheet(excel: sheets_v4.Sheets, spreadsheetId: string): Promise<ExcelSheetResult[]> {
    const ranges = Object.values(CAT_TO_SHEET_NAME).map(name => `${name}!A1:AA`)

    logger.debug(`Loading from excel [${ranges}]...`)
    const [sheetsMetaData, sheetsData] = await Promise.all([
        excel.spreadsheets.get({spreadsheetId, ranges}),
        excel.spreadsheets.values.batchGet({spreadsheetId, ranges})
    ])

    const sheetsParsedRows = sheetsData.data.valueRanges.map((sheet, sheetNo: number) => {
        const sheetId = sheetsMetaData.data.sheets[sheetNo].properties.sheetId

        // Print columns A and E, which correspond to indices 0 and 4.

        const parsedRows = sheet.values
            .map((row: string[], rowNumber: number) => {
                if (rowNumber == 0) {
                    if (JSON.stringify(row) !== JSON.stringify(Object.values(EXCEL_COLUMNS_EVENTS))) {
                        throw new WrongExcelColumnsError({
                            listName: sheetsMetaData.data.sheets[sheetNo].properties.title,
                            expected: Object.values(EXCEL_COLUMNS_EVENTS).join(', '),
                            actual: row.join(', ')
                        })
                    }
                    return
                }

                const keyValueRow = mapRowToColumnObject(row)

                return processExcelRow(keyValueRow, getSheetCategory(sheetNo), new Date(), rowNumber)
            })
            .filter(e => e !== undefined)
        return {
            sheetId,
            totalNumberOfRows: sheet.values?.length,
            rows: parsedRows,
            sheetTitle: sheetsMetaData.data.sheets[sheetNo].properties.title
        } as ExcelSheetResult
    })
    return sheetsParsedRows
}

export async function parseAndValidateGoogleSpreadsheetsEvents(db: BotDb, excel: Sheets, statusCb?: (sheetTitle: string) => Promise<void>): Promise<ExcelParseResult> {
    const sheetsParsedRows = await parseRawSheetsEventSpreedsheet(excel, botConfig.GOOGLE_DOCS_ID)
    logger.debug('Saving to db...')

    const errors: SpreadSheetValidationError[] = []
    const rawEvents: EventToSave[] = []

    // let max = 1;

    const excelUpdater = new ExcelUpdater(excel, EXCEL_COLUMNS_EVENTS)

    const columnToClearFormat: ExcelColumnNameEvents[] = [
        'ext_id', 'publish', 'timetable', 'address', 'place', 'tag_level_1', 'tag_level_2', 'tag_level_3', 'due_date'
    ]

    sheetsParsedRows.forEach(({rows, sheetId, totalNumberOfRows, sheetTitle}) => {

        statusCb?.(sheetTitle)

        columnToClearFormat.forEach(colName => excelUpdater.clearColumnFormat(sheetId, colName, 1, totalNumberOfRows))

        validateUnique(rows)
        const erroredExtIds: string[] = []

        rows.forEach((mapped: ExcelRowResult) => {

            const rowNo = mapped.rowNumber

            if (mapped.publish) {

                if (mapped.errors.timetable && !mapped.data.timetable.includes('???')) {
                    excelUpdater.annotateCell(sheetId, 'timetable', rowNo, mapped.errors.timetable.join('\n'))
                    excelUpdater.colorCell(sheetId, 'timetable', rowNo, 'red')
                } else {
                    excelUpdater.annotateCell(sheetId, 'timetable', rowNo, '')
                }

                for (const mappedElement of mapped.errors.emptyRows) {
                    excelUpdater.colorCell(sheetId, mappedElement, rowNo, 'red')
                }

                if (mapped.errors.extId.length > 0) {
                    excelUpdater.annotateCell(sheetId, 'ext_id', rowNo, mapped.errors.extId.join('\n'))
                    excelUpdater.colorCell(sheetId, 'ext_id', rowNo, 'red')
                } else {
                    excelUpdater.annotateCell(sheetId, 'ext_id', rowNo, '')
                }

                if (mapped.errors.tagLevel1.length > 0) {
                    excelUpdater.annotateCell(sheetId, 'tag_level_1', rowNo, mapped.errors.tagLevel1.join('\n'))
                    excelUpdater.colorCell(sheetId, 'tag_level_1', rowNo, 'red')
                } else {
                    excelUpdater.annotateCell(sheetId, 'tag_level_1', rowNo, '')
                }
                if (mapped.errors.tagLevel2.length > 0) {
                    excelUpdater.colorCell(sheetId, 'tag_level_2', rowNo, 'red')
                    excelUpdater.annotateCell(sheetId, 'tag_level_2', rowNo, mapped.errors.tagLevel2.join('\n'))
                } else if (mapped.warnings.tagLevel2.length > 0) {
                    excelUpdater.colorCell(sheetId, 'tag_level_2', rowNo, 'orange')
                    excelUpdater.annotateCell(sheetId, 'tag_level_2', rowNo, mapped.warnings.tagLevel2.join('\n'))
                }
                if (mapped.errors.tagLevel3.length > 0) {
                    excelUpdater.colorCell(sheetId, 'tag_level_3', rowNo, 'red')
                }

                if (mapped.valid) {
                    rawEvents.push({
                        primaryData: mapped.data,
                        timetable: mapped.timetable,
                        timeIntervals: mapped.timeIntervals,
                        is_anytime: mapped.data.timetable.includes('в любое время'),
                        popularity: mapped.popularity,
                        fakeLikes: mapped.fakeLikes || 0,
                        fakeDislikes: mapped.fakeDislikes || 0,
                    });
                    excelUpdater.colorCell(sheetId, 'publish', rowNo, 'green')

                    // debugTimetable(mapped, excelUpdater, sheetId, rowNo)
                } else {
                    erroredExtIds.push(mapped.data.extId)

                    // rows.push(mapped.data);
                    excelUpdater.colorCell(sheetId, 'publish', rowNo, 'lightred')
                }
            }

            const dueDate = getDueDate(mapped)
            if (!isEqual(mapped.dueDate, dueDate)) {
                excelUpdater.editCellDate(sheetId, 'due_date', rowNo, dueDate)
            }
        })

        errors.push({
            sheetTitle,
            extIds: erroredExtIds
        })
    })

    await statusCb?.('Раскрашиваем эксельку')

    await excelUpdater.update(botConfig.GOOGLE_DOCS_ID)

    return {
        errors,
        rawEvents
    }
}



