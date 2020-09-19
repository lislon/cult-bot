import { annotateCell, CellColor, clearFormat, colorCell, loadExcel } from './googlesheets'
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
import moment = require('moment')
import { Moment } from 'moment'
import { parseTimetable } from '../lib/timetable/parser'
import { predictIntervals } from '../lib/timetable/intervals'
import { mskMoment } from '../util/moment-msk'
import { DbEventToUpdate } from '../interfaces/db-interfaces'

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

async function syncDatabase(rows: DbEventToUpdate[]) {
    if (rows.length > 0) {

        const dbColEvents = new pgp.helpers.ColumnSet(Object.keys(rows[0].primaryData), {table: 'cb_events'});
        const dbColIntervals = new pgp.helpers.ColumnSet(['event_id', 'time_from', 'time_to'], {table: 'cb_time_intervals'});

        await db.tx(async dbTx => {
            await dbTx.none('DELETE FROM cb_events')
            const s = pgp.helpers.insert(rows.map(r => r.primaryData), dbColEvents) + ' RETURNING id'
            // console.log(s)
            const ids = await dbTx.map(s, [], r => +r.id)



            const allIntervals = rows.flatMap((r, index) => {
                const eventId = ids[index]

                const m = r.timeIntervals.map(ti => {
                    if (Array.isArray(ti)) {
                        return {
                            event_id: eventId,
                            time_from: ti[0],
                            time_to: ti[1],
                        }
                    } else {
                        return {
                            event_id: eventId,
                            time_from: ti,
                            time_to: undefined,
                        }
                    }
                })
                return m;
            })

            await dbTx.none(pgp.helpers.insert(allIntervals, dbColIntervals))
        })
    }
}

function debugTimetable(mapped: any, excelUpdater: ExcelUpdater, sheetId: number, rowNo: number) {
    const fromTime = mskMoment().locale('ru')
    const timetableParseResult = parseTimetable(getOnlyBotTimetable(mapped.data.timetable))
    if (timetableParseResult.status !== true) {
        throw new Error('wtf')
    }
    const intervals = predictIntervals(fromTime, timetableParseResult.value)

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

export default async function run(): Promise<{ updated: number, errors: number }> {
    const result = {
        updated: 0,
        errors: 0
    }
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
        const rows: DbEventToUpdate[] = []

        // let max = 1;

        const excelUpdater = new ExcelUpdater(excel)

        sheetsData.data.valueRanges.map(async (sheet, sheetNo: number) => {

            const sheetId = sheetsMetaData.data.sheets[sheetNo].properties.sheetId;
            const numOfRows = sheet.values.length

            excelUpdater.clearColumnFormat(sheetId, 'publish', numOfRows);
            excelUpdater.clearColumnFormat(sheetId, 'timetable', numOfRows);

            // Print columns A and E, which correspond to indices 0 and 4.

            const dateFrom = moment().startOf('week')

            sheet.values.forEach((row: string[], rowNo: number) => {
                const keyValueRow = mapRowToColumnObject(row)

                const mapped = processRow(keyValueRow, getSheetCategory(sheetNo))

                rowNo = EXCEL_HEADER_RESERVED_ROWS + rowNo;

                if (mapped.publish) {

                    if (mapped.valid) {
                        rows.push({
                            primaryData: mapped.data,
                            timeIntervals: predictIntervals(dateFrom, mapped.timetable)
                        });
                        excelUpdater.colorCell(sheetId, 'publish', rowNo, 'green')

                        debugTimetable(mapped, excelUpdater, sheetId, rowNo)
                        result.updated++;
                    } else {
                        result.errors++;
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

        await syncDatabase(rows)

        console.log(`Insertion done. Rows inserted: ${result.updated}, Errors: ${result.errors}`);
        await excelUpdater.update();
        console.log(`Excel updated`);
        return result;

    } catch (e) {
        console.log(e);
        throw e;
    }
}





