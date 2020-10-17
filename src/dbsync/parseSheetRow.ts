import { Event, EventCategory } from '../interfaces/app-interfaces'
import { parseTimetable, TimetableParseResult } from '../lib/timetable/parser'
import { EventTimetable, MomentOrInterval, predictIntervals, validateIntervals } from '../lib/timetable/intervals'
import { fieldIsQuestionMarkOrEmpty } from '../util/filed-utils'
import { subWeeks } from 'date-fns/fp'
import { startOfISOWeek } from 'date-fns'

export const EXCEL_COLUMN_NAMES = [
    'no',
    'publish',
    'subcategory',
    'title',
    'place',
    'address',
    'geotag',
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

// Header row
export const EXCEL_HEADER_SKIP_ROWS = 0

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
        timetable?: string[],
        emptyRows?: ExcelColumnName[],
        invalidTagLevel1?: string[]
        invalidTagLevel2?: string[]
        invalidTagLevel3?: string[]
    }
    timetable?: EventTimetable,
    timeIntervals: MomentOrInterval[]
    data: Event
}

function preparePublish(data: Event, result: ExcelRowResult) {
    if (fieldIsQuestionMarkOrEmpty(data.timetable)) {
        return false
    }

    if (data.publish && (data.publish.toLocaleLowerCase() === 'публиковать' || data.publish === 'TRUE')) {
        delete result.data.publish
        return true
    } else {
        return false
    }
}

export function getOnlyBotTimetable(timetable: string): string {
    let botTimetable = timetable
        .replace(/[(].+?[)]/g, '')

    const matches = botTimetable.match(/{(?:бот|bot):([^}]+)}/)
    if (matches) {
        botTimetable = matches[1]
    }
    return botTimetable
}

export function getOnlyHumanTimetable(timetable: string) {
    return timetable.replace(/{(?:бот|bot):([^}]+)}/, '').trim()
}

function prepareTimetable(data: Event): TimetableParseResult {
    const botTimetable = getOnlyBotTimetable(data.timetable)

    if (data.timetable !== botTimetable) {
        console.log(` > bot convert: "${data.timetable}" -> "${botTimetable}"`)
    }
    return parseTimetable(botTimetable, new Date());
}

function validateTag(tags: string[], errorCallback: (errors: string[]) => void) {
    const badTag = tags.find(t => t.match(/^#[^_\s#?@$%^&*()!-]+$/) === null )
    if (badTag !== undefined) {
        errorCallback([`Плохой тег ${badTag}`])
    }
}

function isAddressValid(data: Event) {
    if (data.address.toLowerCase() === 'онлайн' && data.address.toLowerCase() !== data.address) {
        return false
    }

    return true
}

export function processExcelRow(row: Partial<ExcelRow>, category: EventCategory, now: Date): ExcelRowResult {

    const notNull = (s: string) => s === undefined ? '' : s.trim();
    const notNullOrUnknown = (s: string) => s === undefined ? '' : s;
    const forceDigit = (n: string) => n === undefined ? 0 : +n;
    const splitTags = (s: string) => s.split(/\s+|(?<=[^\s])(?=#)/)

    const data: Event = {
        'category': category,
        'publish': row.publish,
        'subcategory': row.subcategory,
        'title': row.title,
        'place': notNull(row.place),
        'address': notNull(row.address),
        'geotag': notNull(row.geotag),
        'timetable': notNull(row.timetable),
        'duration': notNull(row.duration),
        'price': notNullOrUnknown(row.price),
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
        errors: {
            emptyRows: [],
            invalidTagLevel1: [],
            invalidTagLevel2: [],
            invalidTagLevel3: [],
        },
        timeIntervals: [],
        data
    }

    const timetable = prepareTimetable(data)
    if (timetable.status === true) {

        // TODO: Timzezone
        const WEEKS_AGO = 2
        const WEEKS_AHEAD = 4
        const dateFrom = subWeeks(WEEKS_AGO)(startOfISOWeek(now))

        result.timeIntervals = predictIntervals(dateFrom, timetable.value, (WEEKS_AGO + WEEKS_AHEAD) * 7)
        result.timetable = timetable.value
        const errors = validateIntervals(result.timeIntervals)
        if (errors.length > 0) {
            result.errors.timetable = errors
            result.valid = false
        }
    } else {
        result.errors.timetable = timetable.errors
        result.valid = false
    }
    result.publish = preparePublish(data, result)

    if (!isAddressValid(data)) {
        result.errors.emptyRows.push('address');
    }

    validateTag(data.tag_level_1, (errors) => result.errors.invalidTagLevel1 = errors)
    validateTag(data.tag_level_2, (errors) => result.errors.invalidTagLevel2 = errors)
    validateTag(data.tag_level_3, (errors) => result.errors.invalidTagLevel3 = errors)


    result.valid = result.valid && result.errors.emptyRows.length == 0
    result.valid = result.valid && result.errors.invalidTagLevel1.length == 0
    result.valid = result.valid && result.errors.invalidTagLevel2.length == 0
    result.valid = result.valid && result.errors.invalidTagLevel3.length == 0

    return result
}