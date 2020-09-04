import { annotateCell, CellColor, clearFormat, colorCell, colorRow, loadExcel } from './googlesheets'
import { EventCategory } from '../interfaces/app-interfaces'
import { db, pgp } from '../db'
import {
    CAT_TO_SHEET_NAME,
    EXCEL_COLUMN_NAMES,
    EXCEL_HEADER_RESERVED_ROWS,
    ExcelColumnName,
    ExcelRow, getOnlyBotTimetable,
    processRow
} from './parseSheetRow'
import { sheets_v4 } from 'googleapis'
import Schema$Request = sheets_v4.Schema$Request
import { mapInterval, predictIntervals } from '../lib/timetable/intervals'
import moment = require('moment')
import { parseTimetable } from '../lib/timetable/parser'
import { language } from 'googleapis/build/src/apis/language'
import { Moment } from 'moment'

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
            startRowIndex: EXCEL_HEADER_RESERVED_ROWS,
            endRowIndex: EXCEL_HEADER_RESERVED_ROWS + numOfRows
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
            requestBody: { requests: this.requests }
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

async function updateDatabase(rows: object[]) {
    if (rows.length > 0) {

        const cachedColumnsSet = new pgp.helpers.ColumnSet(Object.keys(rows[0]), {table: 'cb_events'});

        await db.tx(async t => {
            await t.none('DELETE FROM cb_events')
            const s = pgp.helpers.insert(rows, cachedColumnsSet)
            // console.log(s)
            await t.none(s)
        })
    }
}

function debugTimetable(mapped: any, excelUpdater: ExcelUpdater, sheetId: number, rowNo: number) {
    const fromTime = moment().locale('ru')
    const timetable = parseTimetable(getOnlyBotTimetable(mapped.data.timetable)).value
    const intervals = predictIntervals(fromTime, timetable)

    const text = [`События после ${fromTime.format('MM.DD HH:mm')}: `, '-----------']
    if (intervals.length === 0) {
        text.push(' - Нет событий');
    } else {
        intervals.forEach((interval) => {
            function format(m: Moment, format = 'MM.DD HH:mm') {
                return m.locale('ru').format(format)
            }

            if (Array.isArray(interval)) {
                if (interval[0].dayOfYear() == interval[1].dayOfYear()) {
                    text.push(`  ${format(interval[0], 'dd, MM.DD HH:mm')} - ${format(interval[1], 'HH:mm')}`);
                } else {
                    text.push(`  ${format(interval[0])} - ${format(interval[1])}`);
                }
            } else {
                text.push(`  ${format(interval)} `);
            }
        })
    }

    excelUpdater.annotateCell(sheetId, 'timetable', rowNo, text.join('\n'))
}

export default async function run(): Promise<number> {
    try {
        console.log('Connection from excel...')
        const excel = await loadExcel()

        const ranges = Object.values(CAT_TO_SHEET_NAME).map(name => `${name}!A2:Q`);

        console.log(`Loading from excel [${ranges}]...`)

        const [sheetsMetaData, sheetsData] = await Promise.all([
            excel.spreadsheets.get({ spreadsheetId, ranges }),
            excel.spreadsheets.values.batchGet({ spreadsheetId, ranges })
        ]);

        console.log('Saving to db...')
        const rows: object[] = []

        // let max = 1;

        const excelUpdater = new ExcelUpdater(excel)

        sheetsData.data.valueRanges.map(async (sheet, sheetNo: number) => {

            const sheetId = sheetsMetaData.data.sheets[sheetNo].properties.sheetId;
            const numOfRows = sheet.values.length

            excelUpdater.clearColumnFormat(sheetId, 'publish', numOfRows);
            excelUpdater.clearColumnFormat(sheetId, 'timetable', numOfRows);

            // Print columns A and E, which correspond to indices 0 and 4.

            sheet.values.forEach((row: string[], rowNo: number) => {
                const keyValueRow = mapRowToColumnObject(row)

                const mapped = processRow(keyValueRow, getSheetCategory(sheetNo))

                rowNo = EXCEL_HEADER_RESERVED_ROWS + rowNo;

                if (mapped.publish) {

                    if (mapped.valid) {
                        rows.push(mapped.data);
                        excelUpdater.colorCell(sheetId, 'publish', rowNo, 'green')

                        debugTimetable(mapped, excelUpdater, sheetId, rowNo)

                    } else {
                        // rows.push(mapped.data);
                        if (mapped.errors.timetable) {
                            excelUpdater.annotateCell(sheetId, 'timetable', rowNo, mapped.errors.timetable.join('\n'))
                            excelUpdater.colorCell(sheetId, 'timetable', rowNo, 'red')
                        }
                        excelUpdater.colorCell(sheetId, 'publish', rowNo, 'lightred')
                    }
                }
            })
        });

        await updateDatabase(rows)

        console.log(`Insertion done. Rows inserted: ${rows.length}`);
        await excelUpdater.update();
        console.log(`Excel updated`);
        return rows.length;

    } catch (e) {
        console.log(e);
        throw e;
    }
}





