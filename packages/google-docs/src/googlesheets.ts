import { google, sheets_v4 } from 'googleapis'
import { GoogleAuth } from 'google-auth-library'
import { differenceInSeconds, parseISO } from 'date-fns'
import Sheets = sheets_v4.Sheets
import Schema$Request = sheets_v4.Schema$Request


const CELL_BG_COLORS = {
    green: {red: 0.95, green: 1, blue: 0.95},
    lightred: {red: 1, green: 0.95, blue: 0.95},
    red: {red: 0.95, green: 0.8, blue: 0.85},
    orange: {red: 255 / 255.0, green: 240 / 255.0, blue: 219 / 255.0},
}

export type CellColor = keyof typeof CELL_BG_COLORS


export async function authToExcel(authJsonPath: string): Promise<Sheets> {
    const auth = new GoogleAuth({
        keyFile: authJsonPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })
    return google.sheets({version: 'v4', auth})
}


function repeat<T>(param: T, columnsNo: number): T[] {
    return [...Array(columnsNo)].fill(param)
}


export function mkColorRow(sheetId: number, color: CellColor, row: number, columns: number): Schema$Request {

    return {
        updateCells: {
            range: {
                sheetId: sheetId,
                startRowIndex: row - 1,
                endRowIndex: row,
                startColumnIndex: 0,
                endColumnIndex: columns
            },
            fields: 'userEnteredFormat',
            rows: [
                {
                    values: repeat(
                        {
                            userEnteredFormat: {
                                backgroundColor: CELL_BG_COLORS[color]
                            }
                        }, columns)
                }
            ]
        }
    }
}

interface Range {
    startRowIndex: number,
    endRowIndex: number,
    startColumnIndex: number
    endColumnIndex: number
}

export function mkClearFormat(sheetId: number, {startRowIndex, endRowIndex, startColumnIndex, endColumnIndex}: Range): Schema$Request {
    return {
        updateCells: {
            range: {
                sheetId: sheetId,
                startRowIndex,
                endRowIndex,
                startColumnIndex,
                endColumnIndex,
            },
            fields: 'userEnteredFormat, note'
        }
    }
}

export function mkClearSheet(sheetId: number): Schema$Request {
    return {
        'updateCells': {
            'range': {
                'sheetId': sheetId
            },
            'fields': 'userEnteredValue, userEnteredFormat, note'
        }
    }
}


export function mkClearValue(sheetId: number, {startRowIndex, endRowIndex, startColumnIndex, endColumnIndex}: Range): Schema$Request {
    return {
        updateCells: {
            range: {
                sheetId: sheetId,
                startRowIndex,
                endRowIndex,
                startColumnIndex,
                endColumnIndex,
            },
            fields: 'userEnteredValue'
        }
    }
}


export function mkColorCell(sheetId: number, color: CellColor, column: number, row: number): Schema$Request {
    return {
        updateCells: {
            range: {
                sheetId: sheetId,
                startRowIndex: row,
                endRowIndex: row + 1,
                startColumnIndex: column - 1,
                endColumnIndex: column
            },
            fields: 'userEnteredFormat',
            rows: [
                {
                    values: [
                        {
                            userEnteredFormat: {
                                backgroundColor: CELL_BG_COLORS[color]
                            }
                        },
                    ]
                }
            ]
        }
    }
}

export function mkAnnotateCell(sheetId: number, text: string, column: number, row: number): Schema$Request {
    return {
        repeatCell: {
            range: {
                sheetId: sheetId,
                startRowIndex: row,
                endRowIndex: row + 1,
                startColumnIndex: column - 1,
                endColumnIndex: column
            },
            fields: 'note',
            cell: {
                note: text,
            }
        }
    }
}

const GOOGLE_BASE_DATE = parseISO('1899-12-29T23:30:17')

export function mkEditCellDate(sheetId: number, date: Date, column: number, row: number): Schema$Request {
    const diffInDays = +(differenceInSeconds(date, GOOGLE_BASE_DATE) / (3600 * 24)).toFixed(5)
    // console.log(sheetId, diffInDays)
    return {
        updateCells: {
            range: {
                sheetId: sheetId,
                startRowIndex: row,
                endRowIndex: row + 1,
                startColumnIndex: column - 1,
                endColumnIndex: column
            },
            fields: 'userEnteredValue,userEnteredFormat',
            rows: [
                {
                    values: [
                        {
                            userEnteredValue: {
                                numberValue: diffInDays
                            },
                            userEnteredFormat: {
                                numberFormat: {
                                    type: 'DATE',
                                    // pattern: 'yyyy-mm-dd hh:mm:ss'
                                }
                            }
                        },
                    ]
                }
            ]
        }
    }
}

export function mkEditCellValue(sheetId: number, value: string, column: number, row: number): Schema$Request {
    return {
        updateCells: {
            range: {
                sheetId: sheetId,
                startRowIndex: row,
                endRowIndex: row + 1,
                startColumnIndex: column - 1,
                endColumnIndex: column
            },
            fields: 'userEnteredValue',
            rows: [
                {
                    values: [
                        {
                            userEnteredValue: {
                                stringValue: value
                            },
                            // userEnteredFormat: {
                            //     numberFormat: {
                            //         type: 'DATE',
                            //         // pattern: 'yyyy-mm-dd hh:mm:ss'
                            //     }
                            // }
                        },
                    ]
                }
            ]
        }
    }
}