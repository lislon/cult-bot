import { google, sheets_v4 } from 'googleapis'
import { GoogleAuth } from 'google-auth-library'
import * as path from 'path'
import Sheets = sheets_v4.Sheets
import Schema$Request = sheets_v4.Schema$Request


const SERVICE_ACCOUNT_CREDENTIALS_FILE = path.resolve(__dirname, '../../secrets/culthubbot-google-account.json')

export async function loadExcel(): Promise<Sheets> {
    try {
        const auth = authorizeByServiceAccount();
        return google.sheets({version: 'v4', auth})
    } catch (e) {
        console.log('Error loading client secret file:', e);
        return undefined;
    }
}


function authorizeByServiceAccount(): any {
    // Docs: https://developers.google.com/sheets/api/guides/authorizing
    return new GoogleAuth({
        keyFile: SERVICE_ACCOUNT_CREDENTIALS_FILE,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
}

export function colorCell(sheetId: number, color: 'red' | 'green', column: number, row: number): Schema$Request {
    return {
        updateCells: {
            range: {
                sheetId: sheetId,
                startRowIndex: row - 1,
                endRowIndex: row,
                startColumnIndex: column - 1,
                endColumnIndex: column
            },
            fields: 'userEnteredFormat',
            rows: [
                {
                    values: [
                        {
                            userEnteredFormat: {
                                backgroundColor:
                                    color == 'green' ? {
                                        red: 0.95,
                                        green: 1,
                                        blue: 0.95
                                    } : {
                                        red: 1,
                                        green: 0.95,
                                        blue: 0.95
                                    }
                            }
                        },
                    ]
                }
            ]
        }
    }
}