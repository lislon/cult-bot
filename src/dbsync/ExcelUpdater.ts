import { sheets_v4 } from 'googleapis'
import { EXCEL_COLUMN_NAMES, ExcelColumnName } from './parseSheetRow'
import { annotateCell, CellColor, clearFormat, colorCell } from './googlesheets'
import { botConfig } from '../util/bot-config'
import Schema$Request = sheets_v4.Schema$Request

function getColumnIndex(column: ExcelColumnName) {
    return EXCEL_COLUMN_NAMES.indexOf(column) + 1
}

export class ExcelUpdater {
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