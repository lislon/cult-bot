import { Event, EventCategory } from '../interfaces/app-interfaces'
import { EventTimetable, MomentOrInterval } from '../lib/timetable/intervals'
import { fieldIsQuestionMarkOrEmpty } from '../util/filed-utils'
import { parseAndPredictTimetable } from '../lib/timetable/timetable-utils'
import { i18n } from '../util/i18n'

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

export function getOnlyHumanTimetable(timetable: string) {
    return timetable.replace(/{(?:бот|bot):([^}]+)}/, '').trim()
}

function validateTagLevel1(event: Event, errorCallback: (errors: string[]) => void) {
    if (event.category === 'exhibitions') {

        const requiredTags = i18n.resourceKeys('ru')
            .filter((id: string) => id.match(/^scenes[.]packs_scene[.]exhibitions_tags[.]/))
            .map(id => i18n.t(`ru`, id))

        if (event.tag_level_1.find(value => requiredTags.includes(value)) === undefined) {
            errorCallback([
                `Для выставок обязательно должен быть один из тегов:\n ${requiredTags.join('\n')}`
            ])
        }
    }
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
    const predictTimetableResult = parseAndPredictTimetable(data.timetable, now)

    result.timeIntervals = predictTimetableResult.timeIntervals
    result.timetable = predictTimetableResult.timetable
    if (predictTimetableResult.errors.length > 0) {
        result.valid = false
        result.errors.timetable = predictTimetableResult.errors
    }

    result.publish = preparePublish(data, result)

    if (!isAddressValid(data)) {
        result.errors.emptyRows.push('address');
    }

    validateTag(data.tag_level_1, (errors) => result.errors.invalidTagLevel1 = [...result.errors.invalidTagLevel1, ...errors])
    validateTag(data.tag_level_2, (errors) => result.errors.invalidTagLevel2 = [...result.errors.invalidTagLevel2, ...errors])
    validateTag(data.tag_level_3, (errors) => result.errors.invalidTagLevel3 = [...result.errors.invalidTagLevel3, ...errors])
    validateTagLevel1(data, (errors) => result.errors.invalidTagLevel1 = [...result.errors.invalidTagLevel1, ...errors])


    result.valid = result.valid && result.errors.emptyRows.length == 0
    result.valid = result.valid && result.errors.invalidTagLevel1.length == 0
    result.valid = result.valid && result.errors.invalidTagLevel2.length == 0
    result.valid = result.valid && result.errors.invalidTagLevel3.length == 0

    return result
}