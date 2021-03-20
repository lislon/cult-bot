import { sheets_v4 } from 'googleapis'
import { ExcelUpdater } from '@culthub/google-docs'
import { ParsedEvent, ParsedEventToSave } from '../database/parsed-event'
import { ruFormat } from './ruFormat'
import { Recovered } from '@culthub/universal-db-sync'
import { DeletedColumns, DiffReport, WithBotExtId } from '../interfaces'
import { appConfig } from '../app-config'

const DIFF_CONTENT_EXCEL_COLUMNS = {
    category: 'Тип',
    title: 'Заголовок',
    timetable: 'Расписание',
    place: 'Место',
    description: 'Описание',
    tags: 'Теги',
    price: 'Цена',
    botExtId: 'BotID',
    url: 'Ссылка'
}

const CHANGED_EVENTS_COLUMNS = {
    changeType: 'Изм',
    ...DIFF_CONTENT_EXCEL_COLUMNS
}

const SYMBOL_DELETED = '✖️ '
const SYMBOL_UPDATED = '〰️ '
const SYMBOL_ADDED = '➕'

function makeRowWithSingleCell(cellStr: string, headerRow: string[]) {
    return [cellStr, ...(new Array(headerRow.length - 1).fill(''))]
}

function isNothingChanged(diff: DiffReport): boolean {
    return diff.deleted.length === 0 && diff.updated.length === 0 && diff.inserted.length === 0
}


function isDiffColumn(diffField: keyof ParsedEvent | 'botExtId'): diffField is keyof typeof DIFF_CONTENT_EXCEL_COLUMNS {
    return diffField !== 'extId' && diffField != 'description' && diffField != 'parseUrl' && diffField != 'deletedAt' && diffField != 'updatedAt' && diffField !== 'botExtId'
}

function removeZeroZeroFromTimetable<T>(rows: (T & { timetable: string})[]): T[] {
    return rows.map(row => ({...row, ...{timetable: row.timetable.replace(/: 00:00/g, '')}}))
}

export async function saveDiffToExcel(excel: sheets_v4.Sheets, diff: DiffReport, dates: Date[]): Promise<void> {
    const spreadsheetId = appConfig.GOOGLE_DOCS_ID
    if (spreadsheetId === undefined || dates.length === 0) {
        return
    }

    const sheetTitle = `Дифф ${ruFormat(dates[0], 'dd')}-${ruFormat(dates[dates.length - 1], 'dd MMMM')}`

    const meta = await excel.spreadsheets.get({spreadsheetId})


    const excelUpdater = new ExcelUpdater(excel, CHANGED_EVENTS_COLUMNS)

    const existing = meta.data.sheets?.filter(s => s.properties?.title === sheetTitle)
    let sheetId: number | undefined = undefined

    if (existing === undefined || existing.length === 0) {
        excelUpdater.addSheet(sheetTitle)
    } else if (existing.length === 1 && existing[0].properties?.sheetId) {
        sheetId = existing[0].properties?.sheetId
        await excelUpdater.clearValues(existing[0].properties.sheetId, 'changeType', 'title', 1, 1000)
    }
    await excelUpdater.update(spreadsheetId)

    let rows: { [key in keyof typeof CHANGED_EVENTS_COLUMNS]: string }[] = []

    rows = [...rows, ...diff.updated.map(eToUpdate => ({
        changeType: SYMBOL_UPDATED,
        ...eventToRow(eToUpdate.primaryData)
    }))]

    if (sheetId !== undefined) {
        const updatedRowsStartsAt = 2
        Object.keys(DIFF_CONTENT_EXCEL_COLUMNS).forEach((column: keyof typeof DIFF_CONTENT_EXCEL_COLUMNS) => {
            if (sheetId !== undefined) {
                excelUpdater.clearColumnFormat(sheetId, column, 1, 1000)
                excelUpdater.clearValues(sheetId, 'changeType', 'url', 1, 1000)
            }
        })
        await excelUpdater.update(spreadsheetId)

        diff.updated.forEach((eToUpdate, index) => {
            eToUpdate.diffFields.forEach(diffField => {
                if (sheetId !== undefined && isDiffColumn(diffField)) {
                    excelUpdater.colorCell(sheetId, diffField, updatedRowsStartsAt + index, 'orange')
                }
            })
        })
    }

    rows = [...rows, ...diff.deleted.map((eToDelete: (Recovered<ParsedEventToSave, DeletedColumns> & WithBotExtId)) => ({
        changeType: SYMBOL_DELETED,
        category: eToDelete.old.category,
        title: eToDelete.old.title,
        url: '',
        timetable: '',
        price: '',
        description: '',
        date_parsed: '',
        place: '',
        tags: '',
        botExtId: eToDelete.botExtId || ''
    }))]

    rows = [...rows, ...diff.inserted.map(eToSave => ({
        changeType: SYMBOL_ADDED,
        ...eventToRow(eToSave.primaryData)
    }))]

    rows = removeZeroZeroFromTimetable(rows)

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
        ...(isNothingChanged(diff) ? [makeRowWithSingleCell(`Ничего не поменялось. ${diff.notChangedCount} событий без изменений`, headerRow)] : []),
        ...finalData])

    if (sheetId !== undefined) {
        await excelUpdater.update(spreadsheetId)
    }
}

function eventToRow(e: Omit<ParsedEvent, 'id'> & WithBotExtId): { [key in keyof typeof DIFF_CONTENT_EXCEL_COLUMNS]: string } {
    const row = {
        category: e.category,
        title: e.title,
        timetable: e.timetable,
        place: e.place,
        description: e.description || '',
        tags: e.tags.join(' '),
        price: e.price,
        url: e.url,
        date_parsed: e.updatedAt ? ruFormat(e.updatedAt, 'yyyy-MM-dd') : '?',
        botExtId: e.botExtId || ''
    }
    return row
}

export async function saveCurrentToExcel(excel: sheets_v4.Sheets, events: Omit<ParsedEvent, 'id'>[], dates: Date[]): Promise<void> {
    const spreadsheetId = appConfig.GOOGLE_DOCS_ID
    if (spreadsheetId === undefined) {
        return
    }
    const sheetTitle = `База ${ruFormat(dates[0], 'dd')}-${ruFormat(dates[dates.length - 1], 'dd MMMM')}`

    const meta = await excel.spreadsheets.get({spreadsheetId /*, ranges: [ `${title}!A1:AA`]*/})


    const excelUpdater = new ExcelUpdater(excel, DIFF_CONTENT_EXCEL_COLUMNS)

    const existing = meta.data.sheets?.filter(s => s.properties?.title === sheetTitle)

    if (existing === undefined || existing.length === 0) {
        excelUpdater.addSheet(sheetTitle)
    } else if (existing.length === 1 && existing[0].properties?.sheetId) {
        await excelUpdater.clearValues(existing[0].properties.sheetId, 'category', 'url', 1, 1000)
    }
    await excelUpdater.update(spreadsheetId)

    // meta = await excel.spreadsheets.get({spreadsheetId, ranges: [ `${title}!A1:AA`]})

    events = removeZeroZeroFromTimetable(events)

    const data: string[][] = events.map(e => {
        const row = eventToRow(e)
        const result = []
        const strings = Object.keys(DIFF_CONTENT_EXCEL_COLUMNS) as (keyof typeof DIFF_CONTENT_EXCEL_COLUMNS)[]
        for (const rowElement of strings) {
            result.push(row[rowElement])
        }
        return result
    })


    const headerRow = Object.values(DIFF_CONTENT_EXCEL_COLUMNS)

    await excelUpdater.updateOnlyValues(spreadsheetId, sheetTitle, [
        makeRowWithSingleCell('Дата парсинга: ' + ruFormat(new Date(), 'dd MMMM HH:mm'), headerRow),
        headerRow,
        ...data]
    )
}
