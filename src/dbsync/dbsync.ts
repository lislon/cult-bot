import { colorCell, loadExcel } from './googlesheets'
import { EventCategory } from '../interfaces/app-interfaces'
import { db, pgp } from '../db'
import { categoryToSheetName, mapSheetRow } from './parseSheetRow'
import { sheets_v4 } from 'googleapis'
import Schema$Request = sheets_v4.Schema$Request

// our set of columns, to be created only once (statically), and then reused,
// to let it cache up its formatting templates for high performance:
const spreadsheetId = process.env.GOOGLE_DOCS_ID;

export default async function run(): Promise<number> {
    try {
        console.log('Connection from excel...')
        const excel = await loadExcel()

        const ranges = Object.values(categoryToSheetName).map(name => `${name}!A2:Q`);

        console.log(`Loading from excel [${ranges}]...`)
        const [sheetsMetaData, sheetsData] = await Promise.all([
            excel.spreadsheets.get({ spreadsheetId, ranges }),
            excel.spreadsheets.values.batchGet({ spreadsheetId, ranges })
        ]);
        // const sheetsMetaData  = await excel.spreadsheets.get({ spreadsheetId, ranges })
        // const sheetsData = await excel.spreadsheets.values.batchGet({ spreadsheetId, ranges })

        console.log('Saving to db...')
        const rows: object[] = []

        const updateRequests: Schema$Request[] = []
        sheetsData.data.valueRanges.map(async (sheet, sheetNo: number) => {

            const sheetId = sheetsMetaData.data.sheets[sheetNo].properties.sheetId;

            // Print columns A and E, which correspond to indices 0 and 4.

            sheet.values.forEach((row, id) => {
                const cat = Object.keys(categoryToSheetName)[sheetNo] as EventCategory;
                const mapped = mapSheetRow(row, cat)
                if (mapped !== undefined) {
                    rows.push(mapped);
                    updateRequests.push(colorCell(sheetId, 'green', 2, 2 + id))
                }
            })
        });

        if (rows.length > 0) {

            const cachedColumnsSet = new pgp.helpers.ColumnSet(Object.keys(rows[0]), {table: 'cb_events'});

            await db.tx(async t => {
                await t.none('DELETE FROM cb_events')
                const s = pgp.helpers.insert(rows, cachedColumnsSet)
                // console.log(s)
                await t.none(s)
            })
            pgp.end();
        }

        console.log(`Insertion done. Rows inserted: ${rows.length}`);

        await excel.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: { requests: updateRequests }
            });
        console.log(`Excel updated`);
        return rows.length;

    } catch (e) {
        console.log(e);
        throw e;
    }
}





