export interface ExcelSheetResult<T> {
    totalNumberOfRows: number
    sheetId: number
    sheetTitle: string
    rows: T[]
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