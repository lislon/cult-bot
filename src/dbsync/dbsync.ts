import { loadExcel } from './googlesheets'
import { EventCategory } from '../interfaces/app-interfaces'
import { db, pgp } from '../db'

// our set of columns, to be created only once (statically), and then reused,
// to let it cache up its formatting templates for high performance:

const categoryToSheetName: { [key in EventCategory]?: string } = {
        'theaters': 'Театр',
        'exhibitions': 'Выставки',
        'concerts': 'Концерты',
        'events': 'Мероприятия',
        'movies': 'Кино',
        'walks': 'Прогулки'
    }

// Load client secrets from a local file.
; (async function run() {
    try {

        console.log('Connection from excel...')
        const excel = await loadExcel()

        const ranges = Object.values(categoryToSheetName).map(name => `${name}!A2:Q`);

        console.log(`Loading from excel [${ranges}]...`)
        const res = await excel.spreadsheets.values.batchGet({
            spreadsheetId: process.env.GOOGLE_DOCS_ID,
            ranges,
        })
        console.log('Saving to db...')

        const rows: object[] = []
        res.data.valueRanges.map((sheet, sheetNo) => {

            // Print columns A and E, which correspond to indices 0 and 4.
            sheet.values.map((row: any) => {
                const notNull = (s: string) => s === undefined ? '' : s;
                const forceDigit = (n: string) => n === undefined ? 0 : +n;
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
                    'rating': forceDigit(row[c++]),
                    'reviewer': notNull(row[c]),
                }
                if (data.publish && data.publish.toLocaleLowerCase() === 'публиковать') {
                    delete data.publish
                    rows.push(data);
                }
            })
        });

        if (rows.length > 0) {

            const cachedColumnsSet = new pgp.helpers.ColumnSet(
                Object.keys(rows[0]), {table: 'cb_events'});


            await db.tx(async t => {
                await t.none('DELETE FROM cb_events')
                const s = pgp.helpers.insert(rows, cachedColumnsSet)
                // console.log(s)
                await t.none(s)
            })
            pgp.end();
        }

        console.log(`Insertion done. Rows inserted: ${rows.length}`);

    } catch (e) {
        return console.log(e);
    }
})()





