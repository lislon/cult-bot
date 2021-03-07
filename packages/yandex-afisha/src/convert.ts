// Require library
import fs from 'fs'
import glob from 'glob-promise'
import { Place, PlaceWithMeta } from './interfaces'
import { sheets_v4 } from 'googleapis'
import { ExcelUpdater, authToExcel } from '@culthub/google-docs'
import { ruFormat } from './lib/ruFormat'
import { parseISO } from 'date-fns'
import { dates } from './settings'
import { appConfig } from './app-config'

// options is optional

function getParsedDate(file: string): string {
    const m = file.match(/[\d]+-[\d]+-[\d]+/)
    return m ? m[0] : ''
}

function readEventsFromFile(file: string): PlaceWithMeta[] {
    const buffer = fs.readFileSync(file)
    const events = JSON.parse(buffer.toString()) as Place[]
    const parseDate = getParsedDate(file)
    return events.map(e => {
        return {
            ...e,
            parseDate: parseISO(parseDate)
        }
    })
}

async function loadEvents(dates: string[]) {
    const files = (await glob("data/yandex-*-snapshot.json"))
        .filter(fileName => dates.find(d => fileName.includes(d)))
        .sort()

    return files.flatMap(readEventsFromFile);
}

(async function () {
    const allEvents = await loadEvents(dates);


    const excel = await authToExcel(appConfig.GOOGLE_AUTH_FILE)
    if (excel !== undefined) {
        await saveToExcel(excel, allEvents, dates)
        console.log(dates[0] + ' done')
    }

    // fs.readFileSync(`yandex-afisha-${date}.json`, JSON.stringify(allData), function (err) {
    //
    //     if (err) throw err;
    // })
})()


// Весь
// Театр
// Кино
// Концерты
// другое

// Изменения:
// - Изменение даты
// - Цены
// -

export async function saveToExcel(excel: sheets_v4.Sheets, events: PlaceWithMeta[], dates: string[]): Promise<void> {
    const spreadsheetId = process.env.GOOGLE_DOCS_ID;
    if (spreadsheetId === undefined) {
        return
    }

    const title = `${ruFormat(parseISO(dates[0]), 'dd')}-${ruFormat(parseISO(dates[1]), 'dd MMMM')}`

    const meta = await excel.spreadsheets.get({spreadsheetId /*, ranges: [ `${title}!A1:AA`]*/})

    const excelUpdater = new ExcelUpdater(excel, [])

    const existing = meta.data.sheets?.map(s => s.properties?.title)

    if (!existing?.includes(title)) {
        excelUpdater.addSheet(title)
        await excelUpdater.update(spreadsheetId)
    }

    // meta = await excel.spreadsheets.get({spreadsheetId, ranges: [ `${title}!A1:AA`]})

    const header = {
        parseDate: 'Суббота/Воскресенье',
        type: 'Тип',
        title: 'Заголовок',
        dates: 'Даты',
        place: 'Место',
        argument: 'argument',
        tags: 'Теги',
        price: 'Цена',
        url: 'Ссылка'
    }


    const data: string[][] = events.map(e => {
        const row = {
            parseDate: ruFormat(e.parseDate, 'dd MMMM (iii)'),
            type: e.event.type.name,
            title: e.event.title,
            dates: e.scheduleInfo?.dates.join(', '),
            place: e.scheduleInfo?.placePreview,
            argument: e.event.argument || '',
            tags: e.event.tags.map(t => `#${t.name}`).join(' '),
            price: `${e.event.tickets[0]?.price.min / 100}-${e.event.tickets[0]?.price.max / 100} ${e.event.tickets[0]?.price.currency}`,
            url: `https://afisha.yandex.ru${e.event.url}`
        } as { [key in keyof typeof header]: string }
        const result = []
        const strings = Object.keys(header) as (keyof typeof header)[]
        for (const rowElement of strings ) {
            result.push(row[rowElement])
        }
        return result
    });

    await excelUpdater.updateValues(spreadsheetId, title, [Object.values(header), ...data])
}

//
//     await excelUpdater.update(spreadsheetId);
//     // logger.debug(`Excel updated`);
//     return {
//         errors,
//         rawEvents
//     };
// }
