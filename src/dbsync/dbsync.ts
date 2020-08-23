import { loadExcel } from './googlesheets'
import { config } from 'dotenv'
import pg_promise from 'pg-promise'

config();


// our set of columns, to be created only once (statically), and then reused,
// to let it cache up its formatting templates for high performance:

const categoryToSheetName = {
        Theatre: 'Театр',
        Exhibition: 'Выставки'
    }

// Load client secrets from a local file.
; (async function run() {
    try {

        const excel = await loadExcel()

        const ranges = Object.values(categoryToSheetName).map(name => `${name}!A4:Q`);

        const res = await excel.spreadsheets.values.batchGet({
            spreadsheetId: process.env.GOOGLE_DOCS_ID,
            ranges,
        })

        const rows: object[] = []
        res.data.valueRanges.map((sheet, sheetNo) => {

            // Print columns A and E, which correspond to indices 0 and 4.
            sheet.values.map((row: any) => {
                const notNull = (s: string) => s === undefined ? '' : s;
                let c = 1;
                const data = {
                    'category': Object.keys(categoryToSheetName)[sheetNo] as string,
                    'publish': row[c++],
                    'subcategory': row[c++],
                    'title': row[c++],
                    'place': notNull(row[c++]),
                    'address': notNull(row[c++]),
                    'timetable': notNull(row[c++]),
                    'duration': notNull(row[c++]),
                    'price': notNull(row[c++]),
                    'notes': notNull(row[c++]),
                    'description': row[c++],
                    'url': notNull(row[c++]),
                    'tag_level_1': notNull(row[c++]),
                    'tag_level_2': notNull(row[c++]),
                    'tag_level_3': notNull(row[c++]),
                    'rating': notNull(row[c++]),
                    'reviewer': notNull(row[c]),
                }
                if (data.publish && data.publish.toLocaleLowerCase() === 'публиковать') {
                    delete data.publish
                    rows.push(data);
                }
            })
        });

        const pgp = pg_promise({
            capSQL: true,
        });

        if (rows.length > 0) {
            const db = pgp({
                host: process.env.PGHOST,
                port: +process.env.PGPORT,
                database: process.env.PGDATABASE,
                user: process.env.PGUSER,
                password: process.env.PGPASSWORD,
                max: +process.env.PGMAXCONNECTIONS
            })
            const cachedColumnsSet = new pgp.helpers.ColumnSet(
                Object.keys(rows[0]), {table: 'cb_events'});


            await db.tx(async t => {
                await t.none('DELETE FROM cb_events')
                const s = pgp.helpers.insert(rows, cachedColumnsSet)
                console.log(s)
                await t.none(s)
            })
            pgp.end();
        }

        console.log(`Insertion done. Rows inserted: ${rows.length}`);

    } catch (e) {
        return console.log(e);
    }
})()





