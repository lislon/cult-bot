import { EventCategory } from '@culthub/interfaces'
import {
    CAT_TO_SHEET_NAME,
    EXCEL_COLUMNS_EVENTS,
    ExcelColumnNameEvents,
    ExcelEventRow,
    ExcelRowEvents,
    processExcelRow
} from './parseSheetRow'
import { sheets_v4 } from 'googleapis'
import { EventToSave } from '../interfaces/db-interfaces'
import { BotDb } from '../database/db'
import { isEqual, parseISO } from 'date-fns'
import { botConfig } from '../util/bot-config'
import { logger } from '../util/logger'
import { countBy, last } from 'lodash'
import { ExcelUpdater } from '@culthub/google-docs'
import { rightDate } from '@culthub/timetable'
import { ExcelSheetResult, RowMapping } from './dbsync-common'
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

function validateUnique(excelRows: ExcelEventRow[]) {
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

function getDueDate(mapped: ExcelEventRow) {
    const lastEventDate = last(mapped.predictedIntervals)
    if (lastEventDate === undefined) {
        return OLD_DATE
    } else if (mapped.parsedTimetable?.anytime) {
        return FUTURE_DATE
    } else {
        return rightDate(last(mapped.predictedIntervals))
    }
}

export async function parseRawSheetsEventSpreadsheet(excel: sheets_v4.Sheets, spreadsheetId: string): Promise<ExcelSheetResult<ExcelEventRow, typeof EXCEL_COLUMNS_EVENTS>[]> {
    const ranges = Object.values(CAT_TO_SHEET_NAME).map(name => `${name}!A1:AA`)

    logger.debug(`Loading from excel [${ranges}]...`)
    const [sheetsMetaData, sheetsData] = await Promise.all([
        excel.spreadsheets.get({spreadsheetId, ranges}),
        excel.spreadsheets.values.batchGet({spreadsheetId, ranges})
    ])

    return sheetsData.data.valueRanges.map((sheet, sheetNo: number) => {
        const sheetId = sheetsMetaData.data.sheets[sheetNo].properties.sheetId

        // Print columns A and E, which correspond to indices 0 and 4.

        const rowMapper = new RowMapping(EXCEL_COLUMNS_EVENTS)
        const parsedRows = sheet.values
            .map((row: string[], rowNumber: number) => {
                if (rowNumber == 0) {
                    rowMapper.initHeader(row)
                } else {
                    const keyValueRow = rowMapper.getRow(row)
                    return processExcelRow(keyValueRow, getSheetCategory(sheetNo), new Date(), rowNumber)
                }
            })
            .filter(e => e !== undefined)
        return {
            sheetId,
            totalNumberOfRows: sheet.values?.length,
            rows: parsedRows,
            sheetTitle: sheetsMetaData.data.sheets[sheetNo].properties.title,
            rowMapper
        }
    })
}

export async function parseAndValidateGoogleSpreadsheetsEvents(db: BotDb, excel: Sheets, statusCb?: (sheetTitle: string) => Promise<void>): Promise<ExcelParseResult> {
    const sheetsParsedRows = await parseRawSheetsEventSpreadsheet(excel, botConfig.GOOGLE_DOCS_ID)
    logger.debug('Saving to db...')

    const errors: SpreadSheetValidationError[] = []
    const rawEvents: EventToSave[] = []

    // let max = 1;

    const excelUpdater = new ExcelUpdater(excel)

    const columnToClearFormat: ExcelColumnNameEvents[] = [
        'ext_id', 'publish', 'timetable', 'address', 'place', 'tag_level_1', 'tag_level_2', 'tag_level_3', 'due_date', 'duration'
    ]

    sheetsParsedRows.forEach(({rows, sheetId, totalNumberOfRows, sheetTitle, rowMapper}) => {

        statusCb?.(sheetTitle)
        const sheetUpdater = excelUpdater.useSheet<typeof EXCEL_COLUMNS_EVENTS>(sheetId, r => rowMapper.getIndexByRow(r))

        columnToClearFormat.forEach(colName => sheetUpdater.clearColumnFormat(colName, 1, totalNumberOfRows))

        validateUnique(rows)
        const erroredExtIds: string[] = []

        rows.forEach((mapped: ExcelEventRow) => {

            const rowNo = mapped.rowNumber

            if (mapped.publish) {

                if (mapped.errors.timetable && !mapped.data.timetable.includes('???')) {
                    sheetUpdater.annotateCell('timetable', rowNo, mapped.errors.timetable.join('\n'))
                    sheetUpdater.colorCell('timetable', rowNo, 'red')
                } else {
                    sheetUpdater.annotateCell('timetable', rowNo, '')
                }

                if (mapped.errors.duration && !mapped.data.duration.includes('???')) {
                    sheetUpdater.annotateCell('duration', rowNo, mapped.errors.duration.join('\n'))
                    sheetUpdater.colorCell('duration', rowNo, 'red')
                } else {
                    sheetUpdater.annotateCell('duration', rowNo, '')
                }

                for (const mappedElement of mapped.errors.emptyRows) {
                    sheetUpdater.colorCell(mappedElement, rowNo, 'red')
                }

                if (mapped.errors.extId.length > 0) {
                    sheetUpdater.annotateCell('ext_id', rowNo, mapped.errors.extId.join('\n'))
                    sheetUpdater.colorCell('ext_id', rowNo, 'red')
                } else {
                    sheetUpdater.annotateCell('ext_id', rowNo, '')
                }

                if (mapped.errors.tagLevel1.length > 0) {
                    sheetUpdater.annotateCell('tag_level_1', rowNo, mapped.errors.tagLevel1.join('\n'))
                    sheetUpdater.colorCell('tag_level_1', rowNo, 'red')
                } else {
                    sheetUpdater.annotateCell('tag_level_1', rowNo, '')
                }
                if (mapped.errors.tagLevel2.length > 0) {
                    sheetUpdater.colorCell('tag_level_2', rowNo, 'red')
                    sheetUpdater.annotateCell('tag_level_2', rowNo, mapped.errors.tagLevel2.join('\n'))
                } else if (mapped.warnings.tagLevel2.length > 0) {
                    sheetUpdater.colorCell('tag_level_2', rowNo, 'orange')
                    sheetUpdater.annotateCell('tag_level_2', rowNo, mapped.warnings.tagLevel2.join('\n'))
                }
                if (mapped.errors.tagLevel3.length > 0) {
                    sheetUpdater.colorCell('tag_level_3', rowNo, 'red')
                }

                if (mapped.valid) {
                    rawEvents.push({
                        primaryData: mapped.data,
                        timetable: mapped.parsedTimetable,
                        timeIntervals: mapped.predictedIntervals,
                        is_anytime: mapped.data.timetable.includes('в любое время'),
                        popularity: mapped.popularity,
                        fakeLikes: mapped.fakeLikes || 0,
                        fakeDislikes: mapped.fakeDislikes || 0,
                    });
                    sheetUpdater.colorCell('publish', rowNo, 'green')

                    // debugTimetable(mapped, excelUpdater, sheetId, rowNo)
                } else {
                    erroredExtIds.push(mapped.data.extId)

                    // rows.push(mapped.data);
                    sheetUpdater.colorCell('publish', rowNo, 'lightred')
                }
            }

            const dueDate = getDueDate(mapped)
            if (!isEqual(mapped.dueDate, dueDate)) {
                sheetUpdater.editCellDate('due_date', rowNo, dueDate)
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