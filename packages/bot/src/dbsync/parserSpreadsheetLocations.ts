import { sheets_v4 } from 'googleapis'
import { botConfig } from '../util/bot-config'
import { logger } from '../util/logger'
import { ExcelSheetResult, RowMapping } from './dbsync-common'

export interface ExcelPlaceRow {
    // valid: boolean,
    // errors?: {
    //     // timetable?: string[],
    //     // duration?: string[],
    //     // emptyRows?: ExcelColumnNameEvents[],
    //     // extId?: string[],
    //     // tagLevel1?: string[]
    //     // tagLevel2?: string[]
    //     // tagLevel3?: string[]
    // }
    // warnings?: {
    //     // tagLevel2?: string[]
    // }

    parentTitle: string
    title: string
    address: string
    yandexAddress: string
    tag: string
    url: string
    isComfort: boolean
}

const PLACES_SHEET_NAME = 'Площадки 2'

const EXCEL_COLUMNS_LOCATIONS = {
    parentTitle: 'Группа',
    title: 'Площадка',
    address: 'Адрес',
    yandexAddress: 'Яндекс.карта',
    tag: 'Как это в тегах',
    url: 'Ссылка на сайт',
    isComfort: 'Комфот/ Не комфорт'
}

export async function parseRawSheetsLocationsSpreadsheet(excel: sheets_v4.Sheets): Promise<ExcelSheetResult<ExcelPlaceRow, typeof EXCEL_COLUMNS_LOCATIONS>> {
    const places: ExcelPlaceRow[] = []

    const range = `${PLACES_SHEET_NAME}!A2:AA`

    logger.debug(`Loading from excel [${range}]...`)

    const [sheetsMetaData, sheetsData] = await Promise.all([
        excel.spreadsheets.get({spreadsheetId: botConfig.GOOGLE_DOCS_ID, ranges: [range]}),
        excel.spreadsheets.values.get({
            spreadsheetId: botConfig.GOOGLE_DOCS_ID,
            range: range,
            valueRenderOption: 'FORMULA'
        })
    ])
    const rowMapper = new RowMapping(EXCEL_COLUMNS_LOCATIONS)

    let rowNumber = 0
    let currentParent = ''
    for (const row of sheetsData.data.values) {
        if (rowNumber === 0) {
            rowMapper.initHeader(row)
        } else {
            const { parentTitle, title, address, yandexAddress, tag, url, isComfort } = rowMapper.getRow(row);
            if (address !== '') {
                if (parentTitle !== '') {
                    currentParent = parentTitle;
                }
                places.push({
                    title,
                    parentTitle: currentParent,
                    address,
                    isComfort: isComfort === 'Комфорт',
                    tag,
                    url,
                    yandexAddress
                })
            }
        }

        rowNumber++
    }

    return {
        totalNumberOfRows: rowNumber,
        sheetId: sheetsMetaData.data.sheets[0].properties.sheetId,
        sheetTitle: sheetsMetaData.data.sheets[0].properties.title,
        rows: places,
        rowMapper
    }
}

export async function parseSheetsPlacesSpreadsheet(excel: sheets_v4.Sheets): Promise<ExcelPlaceRow[]> {
    return (await parseRawSheetsLocationsSpreadsheet(excel)).rows;
}

//
// export async function parseAndValidateGoogleSpreadsheetsLocation(db: BotDb, excel: Sheets, statusCb?: (sheetTitle: string) => Promise<void>): Promise<ExcelParseResult> {
//     const sheetsParsedRows = await parseRawSheetsEventSpreedsheet(excel, botConfig.GOOGLE_DOCS_ID)
//     logger.debug('Saving to db...')
//
//     const errors: SpreadSheetValidationError[] = []
//     const rawEvents: EventToSave[] = []
//
//     // let max = 1;
//
//     const excelUpdater = new ExcelUpdater(excel, EXCEL_COLUMNS_EVENTS)
//
//     const columnToClearFormat: ExcelColumnNameEvents[] = [
//         'ext_id', 'publish', 'timetable', 'address', 'place', 'tag_level_1', 'tag_level_2', 'tag_level_3', 'due_date', 'duration'
//     ]
//
//     sheetsParsedRows.forEach(({rows, sheetId, totalNumberOfRows, sheetTitle}) => {
//
//         statusCb?.(sheetTitle)
//
//         columnToClearFormat.forEach(colName => excelUpdater.clearColumnFormat(sheetId, colName, 1, totalNumberOfRows))
//
//         validateUnique(rows)
//         const erroredExtIds: string[] = []
//
//         rows.forEach((mapped: ExcelEventRow) => {
//
//             const rowNo = mapped.rowNumber
//
//             if (mapped.publish) {
//
//                 if (mapped.errors.timetable && !mapped.data.timetable.includes('???')) {
//                     excelUpdater.annotateCell(sheetId, 'timetable', rowNo, mapped.errors.timetable.join('\n'))
//                     excelUpdater.colorCell(sheetId, 'timetable', rowNo, 'red')
//                 } else {
//                     excelUpdater.annotateCell(sheetId, 'timetable', rowNo, '')
//                 }
//
//                 if (mapped.errors.duration && !mapped.data.duration.includes('???')) {
//                     excelUpdater.annotateCell(sheetId, 'duration', rowNo, mapped.errors.duration.join('\n'))
//                     excelUpdater.colorCell(sheetId, 'duration', rowNo, 'red')
//                 } else {
//                     excelUpdater.annotateCell(sheetId, 'duration', rowNo, '')
//                 }
//
//                 for (const mappedElement of mapped.errors.emptyRows) {
//                     excelUpdater.colorCell(sheetId, mappedElement, rowNo, 'red')
//                 }
//
//                 if (mapped.errors.extId.length > 0) {
//                     excelUpdater.annotateCell(sheetId, 'ext_id', rowNo, mapped.errors.extId.join('\n'))
//                     excelUpdater.colorCell(sheetId, 'ext_id', rowNo, 'red')
//                 } else {
//                     excelUpdater.annotateCell(sheetId, 'ext_id', rowNo, '')
//                 }
//
//                 if (mapped.errors.tagLevel1.length > 0) {
//                     excelUpdater.annotateCell(sheetId, 'tag_level_1', rowNo, mapped.errors.tagLevel1.join('\n'))
//                     excelUpdater.colorCell(sheetId, 'tag_level_1', rowNo, 'red')
//                 } else {
//                     excelUpdater.annotateCell(sheetId, 'tag_level_1', rowNo, '')
//                 }
//                 if (mapped.errors.tagLevel2.length > 0) {
//                     excelUpdater.colorCell(sheetId, 'tag_level_2', rowNo, 'red')
//                     excelUpdater.annotateCell(sheetId, 'tag_level_2', rowNo, mapped.errors.tagLevel2.join('\n'))
//                 } else if (mapped.warnings.tagLevel2.length > 0) {
//                     excelUpdater.colorCell(sheetId, 'tag_level_2', rowNo, 'orange')
//                     excelUpdater.annotateCell(sheetId, 'tag_level_2', rowNo, mapped.warnings.tagLevel2.join('\n'))
//                 }
//                 if (mapped.errors.tagLevel3.length > 0) {
//                     excelUpdater.colorCell(sheetId, 'tag_level_3', rowNo, 'red')
//                 }
//
//                 if (mapped.valid) {
//                     rawEvents.push({
//                         primaryData: mapped.data,
//                         timetable: mapped.parsedTimetable,
//                         timeIntervals: mapped.predictedIntervals,
//                         is_anytime: mapped.data.timetable.includes('в любое время'),
//                         popularity: mapped.popularity,
//                         fakeLikes: mapped.fakeLikes || 0,
//                         fakeDislikes: mapped.fakeDislikes || 0,
//                     });
//                     excelUpdater.colorCell(sheetId, 'publish', rowNo, 'green')
//
//                     // debugTimetable(mapped, excelUpdater, sheetId, rowNo)
//                 } else {
//                     erroredExtIds.push(mapped.data.extId)
//
//                     // rows.push(mapped.data);
//                     excelUpdater.colorCell(sheetId, 'publish', rowNo, 'lightred')
//                 }
//             }
//
//             const dueDate = getDueDate(mapped)
//             if (!isEqual(mapped.dueDate, dueDate)) {
//                 excelUpdater.editCellDate(sheetId, 'due_date', rowNo, dueDate)
//             }
//         })
//
//         errors.push({
//             sheetTitle,
//             extIds: erroredExtIds
//         })
//     })
//
//     await statusCb?.('Раскрашиваем эксельку')
//
//     await excelUpdater.update(botConfig.GOOGLE_DOCS_ID)
//
//     return {
//         errors,
//         rawEvents
//     }
// }
//
//
//
//
