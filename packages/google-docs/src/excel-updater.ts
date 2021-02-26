import { sheets_v4 } from 'googleapis'
import { CellColor, mkAnnotateCell, mkClearFormat, mkColorCell, mkEditCellDate, mkEditCellValue } from './googlesheets'
import Schema$Request = sheets_v4.Schema$Request

type StringKeysOf<TObj> = { [K in keyof TObj]: K extends string ? K : never }[keyof TObj]

export class ExcelUpdater<T extends { [Key in K]: string }, K extends StringKeysOf<T>> {
    private requests: Schema$Request[] = []
    private columns: T
    private excel: sheets_v4.Sheets

    constructor(excel: sheets_v4.Sheets, columns: T) {
        this.columns = columns
        this.excel = excel
    }

    private getColumnIndex(column: K) {
        return Object.keys(this.columns).indexOf(column) + 1
    }

    clearColumnFormat(sheetId: number, column: K, startRow: number, numOfRows: number): void {
        this.requests.push(mkClearFormat(sheetId, {
            startColumnIndex: this.getColumnIndex(column) - 1,
            endColumnIndex: this.getColumnIndex(column),
            startRowIndex: startRow,
            endRowIndex: startRow + numOfRows
        }))
    }

    colorCell(sheetId: number, column: K, rowNo: number, color: CellColor): void {
        this.requests.push(mkColorCell(sheetId, color, this.getColumnIndex(column), rowNo))
    }

    annotateCell(sheetId: number, column: K, rowNo: number, note: string): void {
        this.requests.push(mkAnnotateCell(sheetId, note, this.getColumnIndex(column), rowNo))
    }

    async update(spreadsheetId: string): Promise<void> {
        await this.excel.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {requests: this.requests}
        })
    }

    editCellDate(sheetId: number, column: K, rowNo: number, value: Date): void {
        this.requests.push(mkEditCellDate(sheetId, value, this.getColumnIndex(column), rowNo))
    }

    editCellValue(sheetId: number, column: K, rowNo: number, value: string): void {
        this.requests.push(mkEditCellValue(sheetId, value, this.getColumnIndex(column), rowNo))
    }
}