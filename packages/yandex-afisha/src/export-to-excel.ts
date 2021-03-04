import { sheets_v4 } from 'googleapis';
import { PlaceWithMeta } from './interfaces';
import { ExcelUpdater } from '@culthub/google-docs';
import { ParsedEvent } from './database/parsed-event';

export async function saveDiffToExcel(excel: sheets_v4.Sheets, events: PlaceWithMeta[], dates: string[]): Promise<void> {

}

export async function saveCurrentToExcel(excel: sheets_v4.Sheets, events: Omit<ParsedEvent, 'id'>[], dates: string[]): Promise<void> {
    const spreadsheetId = process.env.GOOGLE_DOCS_ID;
    if (spreadsheetId === undefined) {
        return
    }

    // const sheetTitle = `${ruFormat(parseISO(dates[0]), 'dd')}-${ruFormat(parseISO(dates[1]), 'dd MMMM')}`
    const sheetTitle = `All`

    const meta = await excel.spreadsheets.get({spreadsheetId /*, ranges: [ `${title}!A1:AA`]*/})

    const excelUpdater = new ExcelUpdater(excel, [])

    const existing = meta.data.sheets?.map(s => s.properties?.title)

    if (!existing?.includes(sheetTitle)) {
        excelUpdater.addSheet(sheetTitle)
        await excelUpdater.update(spreadsheetId)
    }

    // meta = await excel.spreadsheets.get({spreadsheetId, ranges: [ `${title}!A1:AA`]})

    const header = {
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
            type: e.category,
            title: e.title,
            dates: e.entranceDates.join(', '),
            place: e.place,
            argument: e.description || '',
            tags: e.tags.map(t => `#${t}`).join(' '),
            price: e.price,
            url: `https://afisha.yandex.ru${e.url}`
        } as { [key in keyof typeof header]: string }
        const result = []
        const strings = Object.keys(header) as (keyof typeof header)[]
        for (const rowElement of strings ) {
            result.push(row[rowElement])
        }
        return result
    });

    await excelUpdater.updateValues(spreadsheetId, sheetTitle, [Object.values(header), ...data])
}
