interface ExcelWrongData {
    listName: string
    expected: string
    actual: string
}


export class WrongExcelColumnsError extends Error {

    public readonly data

    constructor(data: ExcelWrongData) {
        super(`wrong excel format '${data.listName}' (expected != actual)\n${data.expected}\n${data.actual}`)
        this.data = data
    }
}