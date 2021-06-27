import { EXCEL_COLUMNS_EVENTS } from './parseSheetRow'

export interface ExcelSheetResult<T, C extends Record<string, string>> {
    totalNumberOfRows: number
    sheetId: number
    sheetTitle: string
    rows: T[]
    rowMapper: RowMapping<C>
}

export class RowMapping<T extends Record<string, string>> {
    private rowKeyToIndex = new Map<keyof T, number>()

    constructor(private columns: T) {
    }

    initHeader(headerRow: string[]): void {
        let countFound = 0
        headerRow.forEach((header, headerColumnIndex) => {
            const i = Object.values(this.columns).indexOf(header)
            if (i >= 0) {
                this.rowKeyToIndex.set(Object.keys(this.columns)[i], headerColumnIndex)
                countFound++
            }
        })
    }

    // 0 - first column
    getIndexByRow(t: keyof T): number {
        return this.rowKeyToIndex.get(t)
    }

    getRow(row: string[]): Record<Extract<keyof T, string>, string> {
        const keyValueRow: Record<string, string> = {}
        for (const key in this.columns) {
            if (!this.rowKeyToIndex.has(key)) {
                throw new Error(`Key '${key}' is not found!`)
            }
            const idx = this.rowKeyToIndex.get(key)
            keyValueRow[key] = row[idx]
        }
        return keyValueRow
    }
}