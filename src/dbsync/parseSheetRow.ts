import { Event, EventCategory } from '../interfaces/app-interfaces'
import { parseTimetable } from '../lib/timetable/parser'

export const EXCEL_COLUMN_NAMES = [
    'no',
    'publish',
    'subcategory',
    'title',
    'place',
    'address',
    'timetable',
    'duration',
    'price',
    'notes',
    'description',
    'url',
    'tag_level_1',
    'tag_level_2',
    'tag_level_3',
    'rating',
    'reviewer',
    'wasOrNot',
    'entryDate',
] as const

export const EXCEL_HEADER_RESERVED_ROWS = 1

export type ExcelColumnName = typeof EXCEL_COLUMN_NAMES[number]
export type ExcelRow = {
    [K in ExcelColumnName]: string
}

export const CAT_TO_SHEET_NAME: { [key in EventCategory]?: string } = {
    'theaters': 'Театр',
    'exhibitions': 'Выставки',
    'concerts': 'Концерты',
    'events': 'Мероприятия',
    'movies': 'Кино',
    'walks': 'Прогулки'

}

interface ExcelRowResult {
    valid: boolean,
    publish: boolean,
    errors?: {
        timetable?: string[]
    }
    data: Event
}

function preparePublish(data: Event, result: ExcelRowResult) {
    if (data.publish && data.publish.toLocaleLowerCase() === 'публиковать') {
        delete result.data.publish
        result.publish = true;
    } else {
        result.publish = false;
    }
}

export function getOnlyBotTimetable(timetable: string) {
    let botTimetable = timetable
        .replace(/[(].+?[)]/, '')

    const matches = botTimetable.match(/{бот:([^}]+)}/)
    if (matches) {
        botTimetable = matches.groups[1]
    }
    return botTimetable
}

export function getOnlyHumanTimetable(timetable: string) {
    return  timetable.replace(/{бот:([^}]+)}/, '').trim()
}

function prepareTimetable(data: Event, result: ExcelRowResult) {
    const botTimetable = getOnlyBotTimetable(data.timetable)

    if (data.timetable !== botTimetable) {
        console.log(` > bot convert: "${data.timetable}" -> "${botTimetable}"`)
    }
    const timetableResult = parseTimetable(botTimetable)
    if (timetableResult.status === false) {

        console.log(' > parse: ' + data.timetable)

        result.valid = false
        result.errors.timetable = timetableResult.error
    }
}

export function processRow(row: Partial<ExcelRow>, category: EventCategory): ExcelRowResult {

    const notNull = (s: string) => s === undefined ? '' : s;
    const forceDigit = (n: string) => n === undefined ? 0 : +n;
    const splitTags = (s: string) => s.replace(/([^\s])#/g, '$1 #')

    const data: Event = {
        'category': category,
        'publish': row.publish,
        'subcategory': row.subcategory,
        'title': row.title,
        'place': notNull(row.place),
        'address': notNull(row.address),
        'timetable': notNull(row.timetable),
        'duration': notNull(row.duration),
        'price': notNull(row.price),
        'notes': notNull(row.notes),
        'description': row.description,
        'url': notNull(row.url),
        'tag_level_1': splitTags(notNull(row.tag_level_1)),
        'tag_level_2': splitTags(notNull(row.tag_level_2)),
        'tag_level_3': splitTags(notNull(row.tag_level_3)),
        'rating': forceDigit(row.rating),
        'reviewer': notNull(row.reviewer),
    }

    const result: ExcelRowResult = {
        valid: true,
        publish: true,
        errors: {},
        data
    }


    prepareTimetable(data, result)
    preparePublish(data, result)

    return result
}