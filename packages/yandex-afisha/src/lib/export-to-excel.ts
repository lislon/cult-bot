import { sheets_v4 } from 'googleapis'
import { ExcelUpdater } from '@culthub/google-docs'
import { EventsSyncDiff, ParsedEvent } from '../database/parsed-event'
import { ruFormat } from './ruFormat'

const ALL_EVENTS_COLUMNS = {
    category: 'Тип',
    title: 'Заголовок',
    timetable: 'Расписание',
    place: 'Место',
    argument: 'argument',
    tags: 'Теги',
    price: 'Цена',
    url: 'Ссылка'
}

const SYMBOL_DELETED = '✖️ '
const SYMBOL_UPDATED = '〰️ '
const SYMBOL_ADDED = '➕'

function makeRowWithSingleCell(cellStr: string, headerRow: string[]) {
    return [cellStr, ...(new Array(headerRow.length - 1).fill(''))]
}

function isNothingChanged(diff: EventsSyncDiff): boolean {
    return diff.deleted.length === 0 && diff.updated.length === 0 && diff.inserted.length === 0
}

export async function saveDiffToExcel(excel: sheets_v4.Sheets, diff: EventsSyncDiff, dates: Date[]): Promise<void> {
    const spreadsheetId = process.env.GOOGLE_DOCS_ID
    if (spreadsheetId === undefined || dates.length === 0) {
        return
    }

    const sheetTitle = `Дифф ${ruFormat(dates[0], 'dd')}-${ruFormat(dates[dates.length - 1], 'dd MMMM')}`

    const meta = await excel.spreadsheets.get({spreadsheetId})

    const CHANGED_EVENTS_COLUMNS = {
        changeType: 'Изм',
        ...ALL_EVENTS_COLUMNS
    }
    const excelUpdater = new ExcelUpdater(excel, CHANGED_EVENTS_COLUMNS)

    const existing = meta.data.sheets?.filter(s => s.properties?.title === sheetTitle)

    if (existing === undefined || existing.length === 0) {
        excelUpdater.addSheet(sheetTitle)
    } else if (existing.length === 1 && existing[0].properties?.sheetId) {
        await excelUpdater.clearValues(existing[0].properties.sheetId, 'changeType', 'title', 1, 1000)
    }
    await excelUpdater.update(spreadsheetId)

    let rows: { [key in keyof typeof CHANGED_EVENTS_COLUMNS]: string }[] = []

    rows = [...rows, ...diff.updated.map(eToUpdate => ({
        changeType: SYMBOL_UPDATED,
        ...eventToRow(eToUpdate.primaryData)
    }))]

    rows = [...rows, ...diff.deleted.map(eToDelete => ({
        changeType: SYMBOL_DELETED,
        category: eToDelete.category,
        title: eToDelete.title,
        url: '',
        timetable: '',
        price: '',
        argument: '',
        date_parsed: '',
        place: '',
        tags: ''
    }))]

    rows = [...rows, ...diff.inserted.map(eToSave => ({
        changeType: SYMBOL_ADDED,
        ...eventToRow(eToSave.primaryData)
    }))]

    const finalData = rows.map(row => {
        const result: string[] = []
        const strings = Object.keys(CHANGED_EVENTS_COLUMNS) as (keyof typeof CHANGED_EVENTS_COLUMNS)[]
        for (const rowElement of strings) {
            result.push(row[rowElement])
        }
        return result
    })

    const headerRow = Object.values(CHANGED_EVENTS_COLUMNS)



    await excelUpdater.updateOnlyValues(spreadsheetId, sheetTitle, [
        makeRowWithSingleCell('Дата парсинга: ' + ruFormat(new Date(), 'dd MMMM HH:mm'), headerRow),
        headerRow,
        ...(isNothingChanged(diff) ? [makeRowWithSingleCell(`Ничего не поменялось. ${diff.notChanged.length} событий без изменений`, headerRow)] : []),
        ...finalData])
}

function eventToRow(e: Omit<ParsedEvent, 'id'>): { [key in keyof typeof ALL_EVENTS_COLUMNS]: string } {
    const row = {
        category: e.category,
        title: e.title,
        timetable: e.timetable,
        place: e.place,
        argument: e.description || '',
        tags: e.tags.join(' '),
        price: e.price,
        url: e.url,
        date_parsed: e.updatedAt ? ruFormat(e.updatedAt, 'yyyy-MM-dd') : '?'
    }
    return row
}

export async function saveCurrentToExcel(excel: sheets_v4.Sheets, events: Omit<ParsedEvent, 'id'>[], dates: Date[]): Promise<void> {
    const spreadsheetId = process.env.GOOGLE_DOCS_ID
    if (spreadsheetId === undefined) {
        return
    }
    const sheetTitle = `База ${ruFormat(dates[0], 'dd')}-${ruFormat(dates[dates.length - 1], 'dd MMMM')}`

    const meta = await excel.spreadsheets.get({spreadsheetId /*, ranges: [ `${title}!A1:AA`]*/})


    const excelUpdater = new ExcelUpdater(excel, ALL_EVENTS_COLUMNS)

    const existing = meta.data.sheets?.filter(s => s.properties?.title === sheetTitle)

    if (existing === undefined || existing.length === 0) {
        excelUpdater.addSheet(sheetTitle)
    } else if (existing.length === 1 && existing[0].properties?.sheetId) {
        await excelUpdater.clearValues(existing[0].properties.sheetId, 'category', 'url', 1, 1000)
    }
    await excelUpdater.update(spreadsheetId)

    // meta = await excel.spreadsheets.get({spreadsheetId, ranges: [ `${title}!A1:AA`]})


    const data: string[][] = events.map(e => {
        const row = eventToRow(e)
        const result = []
        const strings = Object.keys(ALL_EVENTS_COLUMNS) as (keyof typeof ALL_EVENTS_COLUMNS)[]
        for (const rowElement of strings) {
            result.push(row[rowElement])
        }
        return result
    })


    // await excelUpdater.clearValues(spreadsheetId, 'Тип', 'Ссылка', 1, 1000)
    // await excelUpdater.
    const headerRow = Object.values(ALL_EVENTS_COLUMNS)

    await excelUpdater.updateOnlyValues(spreadsheetId, sheetTitle, [
        makeRowWithSingleCell('Дата парсинга: ' + ruFormat(new Date(), 'dd MMMM HH:mm'), headerRow),
        headerRow,
        ...data]
    )
}
