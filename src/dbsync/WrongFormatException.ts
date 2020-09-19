interface ExcelWrongData {
    listName: string
    columnName: string
    expected: string
    actual: string
}


export class WrongExcelColumnsError extends Error {

    public readonly data

    constructor(data: ExcelWrongData) {
        super('wrong excel format')
        this.data = data
    }
}