import { annotateCell, CellColor, clearFormat, colorCell, loadExcel } from './googlesheets'
import { EventCategory } from '../interfaces/app-interfaces'
import {
    CAT_TO_SHEET_NAME,
    EXCEL_COLUMN_NAMES,
    EXCEL_HEADER_SKIP_ROWS,
    ExcelColumnName,
    ExcelRow,
    getOnlyBotTimetable,
    processExcelRow
} from './parseSheetRow'
import { sheets_v4 } from 'googleapis'
import { parseTimetable } from '../lib/timetable/parser'
import { predictIntervals } from '../lib/timetable/intervals'
import { EventToSave } from '../interfaces/db-interfaces'
import { WrongExcelColumnsError } from './WrongFormatException'
import { BotDb } from '../db'
import { differenceInCalendarDays, format, startOfISOWeek } from 'date-fns'
import { subWeeks } from 'date-fns/fp'
import Schema$Request = sheets_v4.Schema$Request

// our set of columns, to be created only once (statically), and then reused,
// to let it cache up its formatting templates for high performance:
const spreadsheetId = process.env.GOOGLE_DOCS_ID;

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
    const timetableParseResult = parseTimetable(getOnlyBotTimetable(mapped.data.timetable))
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
                    text.push(`  ${format2(interval[0], 'dd, MM.dd HH:mm')} - ${format2(interval[1], 'HH:mm')}`);
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

export default async function run(db: BotDb): Promise<{ updated: number, errors: number }> {
    const result = {
        updated: 0,
        errors: 0
    }
    try {
        console.log('Connection from excel...')
        const excel = await loadExcel()

        const ranges = Object.values(CAT_TO_SHEET_NAME).map(name => `${name}!A1:AA`);

        console.log(`Loading from excel [${ranges}]...`)

        const [sheetsMetaData, sheetsData] = await Promise.all([
            excel.spreadsheets.get({ spreadsheetId, ranges }),
            excel.spreadsheets.values.batchGet({ spreadsheetId, ranges })
        ]);

        console.log('Saving to db...')
        const rows: EventToSave[] = []

        // let max = 1;

        const excelUpdater = new ExcelUpdater(excel)

        sheetsData.data.valueRanges.forEach((sheet, sheetNo: number) => {
            const sheetId = sheetsMetaData.data.sheets[sheetNo].properties.sheetId;
            const numOfRows = sheet.values.length

            const columnToClearFormat: ExcelColumnName[] = [
                'publish', 'timetable', 'address', 'place', 'tag_level_1', 'tag_level_2', 'tag_level_3'
            ]

            columnToClearFormat.forEach(colName => excelUpdater.clearColumnFormat(sheetId, colName, numOfRows))
            // Print columns A and E, which correspond to indices 0 and 4.

            // TODO: Timzezone
            const WEEKS_AGO = 2
            const WEEKS_AHEAD = 4
            const dateFrom = subWeeks(WEEKS_AGO)(startOfISOWeek(new Date()))

            sheet.values.forEach((row: string[], rowNo: number) => {

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

                const mapped = processExcelRow(keyValueRow, getSheetCategory(sheetNo))

                rowNo = EXCEL_HEADER_SKIP_ROWS + rowNo;

                if (mapped.publish) {

                    if (mapped.valid) {
                        rows.push({
                            primaryData: mapped.data,
                            timetable: mapped.timetable,
                            timeIntervals: predictIntervals(dateFrom, mapped.timetable, (WEEKS_AGO + WEEKS_AHEAD) * 7),
                            is_anytime: mapped.data.timetable.includes('в любое время')
                        });
                        excelUpdater.colorCell(sheetId, 'publish', rowNo, 'green')

                        debugTimetable(mapped, excelUpdater, sheetId, rowNo)
                        result.updated++;
                    } else {
                        result.errors++;
                        // rows.push(mapped.data);
                        if (mapped.errors.timetable && !mapped.data.timetable.includes('?')) {
                            excelUpdater.annotateCell(sheetId, 'timetable', rowNo, mapped.errors.timetable.join('\n'))
                            excelUpdater.colorCell(sheetId, 'timetable', rowNo, 'red')
                        } else {
                            excelUpdater.annotateCell(sheetId, 'timetable', rowNo, '')
                        }

                        for (const mappedElement of mapped.errors.emptyRows) {
                            excelUpdater.colorCell(sheetId, mappedElement, rowNo, 'red')
                        }

                        if (mapped.errors.invalidTagLevel1.length > 0) {
                            excelUpdater.colorCell(sheetId, 'tag_level_1', rowNo, 'red')
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
        })

        await db.repoSync.syncDatabase(rows)

        console.log(`Insertion done. Rows inserted: ${result.updated}, Errors: ${result.errors}`);
        await excelUpdater.update();
        console.log(`Excel updated`);
        return result;

    } catch (e) {
        console.log(e);
        throw e;
    }
}




