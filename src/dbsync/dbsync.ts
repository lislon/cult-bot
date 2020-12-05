import { annotateCell, CellColor, clearFormat, colorCell, loadExcel } from './googlesheets'
import { EventCategory } from '../interfaces/app-interfaces'
import {
    CAT_TO_SHEET_NAME,
    EXCEL_COLUMN_NAMES,
    EXCEL_HEADER_SKIP_ROWS,
    ExcelColumnName,
    ExcelRow,
    ExcelRowResult,
    processExcelRow
} from './parseSheetRow'
import { sheets_v4 } from 'googleapis'
import { parseTimetable } from '../lib/timetable/parser'
import { predictIntervals } from '../lib/timetable/intervals'
import { EventToSave } from '../interfaces/db-interfaces'
import { WrongExcelColumnsError } from './WrongFormatException'
import { BotDb } from '../database/db'
import { differenceInCalendarDays, format } from 'date-fns'
import { botConfig } from '../util/bot-config'
import { getOnlyBotTimetable } from '../lib/timetable/timetable-utils'
import { logger } from '../util/logger'
import { countBy } from 'lodash'
import { SyncResults } from '../database/db-sync-repository'
import Schema$Request = sheets_v4.Schema$Request

// our set of columns, to be created only once (statically), and then reused,
// to let it cache up its formatting templates for high performance:

function getColumnIndex(column: ExcelColumnName) {
    return EXCEL_COLUMN_NAMES.indexOf(column) + 1
}

class ExcelUpdater {
    private requests: Schema$Request[] = []
    private excel: sheets_v4.Sheets

    constructor(excel: sheets_v4.Sheets) {
        this.excel = excel
    }

    clearColumnFormat(sheetId: number, column: ExcelColumnName, numOfRows: number) {
        this.requests.push(clearFormat(sheetId, {
            startColumnIndex: getColumnIndex(column) - 1,
            endColumnIndex: getColumnIndex(column),
            startRowIndex: 1,
            endRowIndex: 1 + numOfRows
        }))
    }

    colorCell(sheetId: number, column: ExcelColumnName, rowNo: number, color: CellColor) {
        this.requests.push(colorCell(sheetId, color, getColumnIndex(column), rowNo))
    }

    annotateCell(sheetId: number, column: ExcelColumnName, rowNo: number, note: string) {
        this.requests.push(annotateCell(sheetId, note, getColumnIndex(column), rowNo))
    }


    async update() {
        const spreadsheetId = botConfig.GOOGLE_DOCS_ID;
        await this.excel.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {requests: this.requests}
        });
    }
}

function getSheetCategory(sheetNo: number) {
    return Object.keys(CAT_TO_SHEET_NAME)[sheetNo] as EventCategory
}

function mapRowToColumnObject(row: string[]) {
    const keyValueRow: Partial<ExcelRow> = {}
    row.forEach((val: string, index) => keyValueRow[EXCEL_COLUMN_NAMES[index]] = val)
    return keyValueRow
}

function debugTimetable(mapped: any, excelUpdater: ExcelUpdater, sheetId: number, rowNo: number) {
    const fromTime = new Date()
    const timetableParseResult = parseTimetable(getOnlyBotTimetable(mapped.data.timetable), fromTime)
    if (timetableParseResult.status !== true) {
        throw new Error('wtf')
    }
    const intervals = predictIntervals(fromTime, timetableParseResult.value, 14)

    // TODO: TZ
    const text = [`События после ${format(fromTime, 'MM.dd HH:mm')}: `, '-----------']
    if (intervals.length === 0) {
        text.push(' - Нет событий');
    } else {
        intervals.forEach((interval) => {
            function format2(m: Date, formatS = 'MM.dd HH:mm') {
                return format(m, formatS)
            }

            if (Array.isArray(interval)) {
                if (differenceInCalendarDays(interval[0], interval[1]) === 0) {
                    text.push(`  ${format2(interval[0], 'MM.dd HH:mm')} - ${format2(interval[1], 'HH:mm')}`);
                } else {
                    text.push(`  ${format2(interval[0])} - ${format2(interval[1])}`);
                }
            } else {
                text.push(`  ${format2(interval)} `);
            }
        })
    }

    excelUpdater.annotateCell(sheetId, 'timetable', rowNo, text.join('\n'))
}

function validateUnique(excelRows: ExcelRowResult[]) {
    const uniqueId = countBy(excelRows, (e) => e.data.ext_id)
    excelRows.forEach(row => {
        if (uniqueId[row.data.ext_id] !== 1) {
            row.errors.invalidExtId = [...row.errors.invalidExtId, 'ID не уникальный (глобально)']
            row.valid = false
        }
    })
}


export interface ExcelSheetError {
    sheetName: string,
    extIds: string[]
}
export interface ExcelSyncResult {
    errors: ExcelSheetError[]
    syncResult?: SyncResults
}

function listExtIds(eventToSaves: EventToSave[]): string {
    return eventToSaves.map(z => z.primaryData.ext_id).join(',')
}

export default async function run(db: BotDb): Promise<ExcelSyncResult> {
    const syncResult: ExcelSyncResult = {
        errors: []
    }

    try {
        logger.debug('Connection from excel...')
        const excel = await loadExcel()

        const ranges = Object.values(CAT_TO_SHEET_NAME).map(name => `${name}!A1:AA`);

        logger.debug(`Loading from excel [${ranges}]...`)

        const spreadsheetId = botConfig.GOOGLE_DOCS_ID;
        const [sheetsMetaData, sheetsData] = await Promise.all([
            excel.spreadsheets.get({spreadsheetId, ranges}),
            excel.spreadsheets.values.batchGet({spreadsheetId, ranges})
        ]);

        logger.debug('Saving to db...')
        const rows: EventToSave[] = []

        // let max = 1;

        const excelUpdater = new ExcelUpdater(excel)

        sheetsData.data.valueRanges.forEach((sheet, sheetNo: number) => {
            const sheetId = sheetsMetaData.data.sheets[sheetNo].properties.sheetId;
            const numOfRows = sheet.values?.length

            const columnToClearFormat: ExcelColumnName[] = [
                'publish', 'timetable', 'address', 'place', 'tag_level_1', 'tag_level_2', 'tag_level_3'
            ]

            columnToClearFormat.forEach(colName => excelUpdater.clearColumnFormat(sheetId, colName, numOfRows))
            // Print columns A and E, which correspond to indices 0 and 4.

            const parsedRows = sheet.values
                .map((row: string[], rowNo: number) => {
                    if (rowNo == 0) {
                        const columnNo = EXCEL_COLUMN_NAMES.indexOf('wasOrNot')
                        if (row[columnNo] !== 'Была/не была') {
                            throw new WrongExcelColumnsError({
                                listName: sheetsMetaData.data.sheets[sheetNo].properties.title,
                                columnName: String.fromCharCode('A'.charCodeAt(0) + columnNo) + `1`,
                                expected: 'Была/не была',
                                actual: row[columnNo]
                            });
                        }
                        return
                    }

                    const keyValueRow = mapRowToColumnObject(row)

                    const mapped = processExcelRow(keyValueRow, getSheetCategory(sheetNo), new Date())
                    return mapped
                })
                .filter(e => e !== undefined)

            validateUnique(parsedRows)
            const erroredExtIds: string[] = []

            parsedRows.forEach((mapped: ExcelRowResult, rowNo: number) => {

                rowNo = EXCEL_HEADER_SKIP_ROWS + rowNo;

                if (mapped.publish) {

                    if (mapped.valid) {
                        rows.push({
                            primaryData: mapped.data,
                            timetable: mapped.timetable,
                            timeIntervals: mapped.timeIntervals,
                            is_anytime: mapped.data.timetable.includes('в любое время')
                        });
                        excelUpdater.colorCell(sheetId, 'publish', rowNo, 'green')

                        debugTimetable(mapped, excelUpdater, sheetId, rowNo)

                    } else {
                        erroredExtIds.push(mapped.data.ext_id)

                        // rows.push(mapped.data);
                        if (mapped.errors.timetable && !mapped.data.timetable.includes('???')) {
                            excelUpdater.annotateCell(sheetId, 'timetable', rowNo, mapped.errors.timetable.join('\n'))
                            excelUpdater.colorCell(sheetId, 'timetable', rowNo, 'red')
                        } else {
                            excelUpdater.annotateCell(sheetId, 'timetable', rowNo, '')
                        }

                        for (const mappedElement of mapped.errors.emptyRows) {
                            excelUpdater.colorCell(sheetId, mappedElement, rowNo, 'red')
                        }

                        if (mapped.errors.invalidExtId.length > 0) {
                            excelUpdater.annotateCell(sheetId, 'ext_id', rowNo, mapped.errors.invalidExtId.join('\n'))
                            excelUpdater.colorCell(sheetId, 'ext_id', rowNo, 'red')
                        } else {
                            excelUpdater.annotateCell(sheetId, 'ext_id', rowNo, '')
                        }

                        if (mapped.errors.invalidTagLevel1.length > 0) {
                            excelUpdater.annotateCell(sheetId, 'tag_level_1', rowNo, mapped.errors.invalidTagLevel1.join('\n'))
                            excelUpdater.colorCell(sheetId, 'tag_level_1', rowNo, 'red')
                        } else {
                            excelUpdater.annotateCell(sheetId, 'tag_level_1', rowNo, '')
                        }
                        if (mapped.errors.invalidTagLevel2.length > 0) {
                            excelUpdater.colorCell(sheetId, 'tag_level_2', rowNo, 'red')
                        }
                        if (mapped.errors.invalidTagLevel3.length > 0) {
                            excelUpdater.colorCell(sheetId, 'tag_level_3', rowNo, 'red')
                        }

                        excelUpdater.colorCell(sheetId, 'publish', rowNo, 'lightred')
                    }
                }
            })

            syncResult.errors.push({
                sheetName: sheetsMetaData.data.sheets[sheetNo].properties.title,
                extIds: erroredExtIds
            })
        })

        syncResult.syncResult = await db.repoSync.syncDatabase(rows)

        logger.info([
            `Database updated.`,
            `Insertion done.`,
            `inserted={${listExtIds(syncResult.syncResult.insertedEvents)}}`,
            `updated={${listExtIds(syncResult.syncResult.updatedEvents)}}`,
            `deleted={${syncResult.syncResult.deletedEvents.map(d => d.ext_id).join(',')}}`
        ].join(' '));
        await excelUpdater.update();
        logger.debug(`Excel updated`);
        return syncResult;

    } catch (e) {
        logger.error(e);
        throw e;
    }
}




