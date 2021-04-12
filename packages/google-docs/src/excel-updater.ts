import { sheets_v4 } from 'googleapis'
import {
    CellColor,
    mkAnnotateCell,
    mkClearFormat, mkClearNoteAndFormat,
    mkClearSheet,
    mkClearValue,
    mkColorCell,
    mkEditCellDate,
    mkEditCellValue
} from './googlesheets'
import Schema$Request = sheets_v4.Schema$Request
import Schema$BatchUpdateSpreadsheetResponse = sheets_v4.Schema$BatchUpdateSpreadsheetResponse

export class SheetUpdater<T extends Record<string, unknown>> {
    constructor(
        private sheetId: number,
        private requests: Schema$Request[],
        private columnIndexResolve: (column: keyof T) => number
    ) {

    }

    private getColumnIndex(column: keyof T): number {
        return this.columnIndexResolve(column)
    }


    clearColumnFormat(column: keyof T, startRow: number, numOfRows: number): void {
        this.requests.push(mkClearFormat(this.sheetId, {
            startColumnIndex: this.getColumnIndex(column),
            endColumnIndex: this.getColumnIndex(column) + 1,
            startRowIndex: startRow,
            endRowIndex: startRow + numOfRows
        }))
    }

    clearSheet(): void {
        this.requests.push(mkClearSheet(this.sheetId))
    }

    clearNoteAndFormat(fromColumn: keyof T, toColumn: keyof T, startRow: number, numOfRows: number): void {
        this.requests.push(mkClearNoteAndFormat(this.sheetId, {
            startColumnIndex: this.getColumnIndex(fromColumn),
            endColumnIndex: this.getColumnIndex(toColumn) + 1,
            startRowIndex: startRow,
            endRowIndex: startRow + numOfRows
        }))
    }

    clearValues(fromColumn: keyof T, toColumn: keyof T, startRow: number, numOfRows: number): void {
        this.requests.push(mkClearValue(this.sheetId, {
            startColumnIndex: this.getColumnIndex(fromColumn),
            endColumnIndex: this.getColumnIndex(toColumn) + 1,
            startRowIndex: startRow,
            endRowIndex: startRow + numOfRows
        }))
    }

    colorCell(column: keyof T, rowNo: number, color: CellColor): void {
        this.requests.push(mkColorCell(this.sheetId, color, this.getColumnIndex(column), rowNo))
    }

    annotateCell(column: keyof T, rowNo: number, note: string): void {
        this.requests.push(mkAnnotateCell(this.sheetId, note, this.getColumnIndex(column), rowNo))
    }

    editCellDate(column: keyof T, rowNo: number, value: Date): void {
        this.requests.push(mkEditCellDate(this.sheetId, value, this.getColumnIndex(column), rowNo))
    }

    editCellValue(column: keyof T, rowNo: number, value: string): void {
        this.requests.push(mkEditCellValue(this.sheetId, value, this.getColumnIndex(column), rowNo))
    }
}

// const dd = new SheetUpdater()

export class ExcelUpdater {
    private requests: Schema$Request[] = []

    constructor(private excel: sheets_v4.Sheets) {
    }

    public useSheet<T extends Record<string, string>>(sheetId: number, columns: T): SheetUpdater<T>
    public useSheet<T extends Record<string, string>>(sheetId: number, columnToIndex: (column: keyof T) => number): SheetUpdater<T>
    public useSheet<T extends Record<string, string>>(sheetId: number, columnToIndexOrColumns: ((column: keyof T) => number)|T): SheetUpdater<T> {
        if (typeof columnToIndexOrColumns === 'function') {
            return new SheetUpdater<T>(sheetId, this.requests, columnToIndexOrColumns)
        } else {
            return new SheetUpdater<T>(sheetId, this.requests, (column) => {
                return Object.keys(columnToIndexOrColumns).indexOf(column as string)
            })
        }
    }

    async update(spreadsheetId: string): Promise<Schema$BatchUpdateSpreadsheetResponse> {
        if (this.requests.length > 0) {
            const result = await this.excel.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {requests: this.requests}
            })
            this.requests = []
            return result.data
        }
        return {}
    }

    addSheet(title: string): void {
        this.requests.push({
            addSheet: {
                properties: {
                    title: title,
                    // gridProperties: {
                    //     rowCount: 20,
                    //     columnCount: 12
                    // },
                    // tabColor: {
                    //     red: 1.0,
                    //     green: 0.3,
                    //     blue: 0.4
                    // }
                }
            }
        })
    }


    async updateOnlyValues(spreadsheetId: string, title: string, values: string[][]): Promise<void> {
        await this.excel.spreadsheets.values.update({
                // The A1 notation of the values to update.
                range: `${title}!A1:AA`,
                spreadsheetId: spreadsheetId,
                valueInputOption: 'USER_ENTERED',

                // Request body metadata
                requestBody: {
                    'majorDimension': 'ROWS',
                    // "range": "A1:B2",
                    'values': values,
                }
            }
        )
    }
}