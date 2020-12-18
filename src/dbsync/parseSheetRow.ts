import { Event, EventCategory } from '../interfaces/app-interfaces'
import { EventTimetable, MomentOrInterval } from '../lib/timetable/intervals'
import { fieldIsQuestionMarkOrEmpty } from '../util/filed-utils'
import { parseAndPredictTimetable } from '../lib/timetable/timetable-utils'
import { i18n } from '../util/i18n'
import { parseISO } from 'date-fns'

export const EXCEL_COLUMNS_EVENTS = {
    ext_id: '№',
    publish: 'Публикация',
    subcategory: 'Вид',
    title: 'Название',
    place: 'Место ',
    address: 'Адрес',
    geotag: 'Yandex.Maps',
    timetable: 'Время (Формат)',
    duration: 'Длительность осмотра',
    price: 'Стоимость',
    notes: 'Особенности',
    description: 'Описание',
    url: 'Ссылка',
    tag_level_1: 'Теги 1 уровня',
    tag_level_2: 'Теги 2 уровня',
    tag_level_3: 'Теги 3 уровня',
    rating: 'Оценка',
    reviewer: 'Кто описал',
    wasOrNot: 'Была/не была',
    entry_date: 'Дата обновления',
    due_date: 'Due date'
}

export type ExcelColumnNameEvents = keyof typeof EXCEL_COLUMNS_EVENTS
export type ExcelRowEvents = {
    [K in ExcelColumnNameEvents]: string
}

export const CAT_TO_SHEET_NAME: { [key in EventCategory]?: string } = {
    'theaters': 'Театр',
    'exhibitions': 'Выставки',
    'concerts': 'Концерты',
    'events': 'Мероприятия',
    'movies': 'Кино',
    'walks': 'Прогулки'

}

export interface ExcelRowResult {
    valid: boolean,
    publish: boolean,
    errors?: {
        timetable?: string[],
        emptyRows?: ExcelColumnNameEvents[],
        invalidExtId?: string[],
        invalidTagLevel1?: string[]
        invalidTagLevel2?: string[]
        invalidTagLevel3?: string[]
    }
    timetable?: EventTimetable,
    timeIntervals: MomentOrInterval[]
    rowNumber: number
    data: Event
    dueDate: Date
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
            .filter((id: string) => id.match(/^scenes[.]tops_scene[.]exhibitions_tags[.]/))
            .map(id => i18n.t(`ru`, id))

        if (event.tag_level_1.find(value => requiredTags.includes(value)) === undefined) {
            errorCallback([
                `Для выставок обязательно должен быть один из тегов:\n ${requiredTags.join('\n')}`
            ])
        }
        if (event.tag_level_1.length === 1) {
            errorCallback([
                `Для выставок должен обязательно второй тег, иначе её будет не найти в подборках под себя`
            ])
        }
    }
}

function validateTag(tags: string[], errorCallback: (errors: string[]) => void) {
    const badTag = tags.find(t => t.match(/^#[^_\s#?@$%^&*()!\\№:;',-]+$/) === null )
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

function validateExtId(data: Event, errorCallback: (errors: string[]) => void): void {
    const extId = data.ext_id
    if (extId?.match(/^[А-Я]/)) {
        return errorCallback([`Замечена русская буква '${extId.substring(0, 1)}' в ID-шнике. Допускаются только английские`])
    }
    const CATEGORY_TO_LETTER = {
        theaters: 'T',
        exhibitions: 'V',
        concerts: 'K',
        events: 'M',
        movies: 'C',
        walks: 'P',
    }
    const startLetter = CATEGORY_TO_LETTER[data.category]
    if (startLetter === undefined) {
        throw new Error(`Unknown category: ${data.category}`)
    }
    if (!extId?.startsWith(startLetter) && extId?.match(/^.\d+[A-Z]?$/)) {
        return errorCallback([`Идентификатор для категории ${data.category} должен начинатся с буквы '${startLetter}'.
            \nЗатем должна идти цифра, и возможно другая буква, например: ${startLetter}123 или ${startLetter}123B`])
    }
}

export function processExcelRow(row: Partial<ExcelRowEvents>, category: EventCategory, now: Date, rowNo: number): ExcelRowResult {

    const notNull = (s: string) => s === undefined ? '' : s.trim();
    const notNullOrUnknown = (s: string) => s === undefined ? '' : s;
    const forceDigit = (n: string) => n === undefined ? 0 : +n;
    const splitTags = (s: string) => s.split(/\s+|(?<=[^\s])(?=#)/)

    const data: Event = {
        'ext_id': row.ext_id,
        'category': category,
        'publish': row.publish,
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
            invalidExtId: [],
        },
        dueDate: notNull(row.due_date) ? parseISO(notNull(row.due_date)) : undefined,
        timeIntervals: [],
        rowNumber: rowNo,
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

    validateExtId(data, (errors) => result.errors.invalidExtId = errors)

    validateTag(data.tag_level_1, (errors) => result.errors.invalidTagLevel1 = [...result.errors.invalidTagLevel1, ...errors])
    validateTag(data.tag_level_2, (errors) => result.errors.invalidTagLevel2 = [...result.errors.invalidTagLevel2, ...errors])
    validateTag(data.tag_level_3, (errors) => result.errors.invalidTagLevel3 = [...result.errors.invalidTagLevel3, ...errors])
    validateTagLevel1(data, (errors) => result.errors.invalidTagLevel1 = [...result.errors.invalidTagLevel1, ...errors])


    result.valid = result.valid && result.errors.emptyRows.length == 0
    result.valid = result.valid && result.errors.invalidTagLevel1.length == 0
    result.valid = result.valid && result.errors.invalidTagLevel2.length == 0
    result.valid = result.valid && result.errors.invalidTagLevel3.length == 0
    result.valid = result.valid && result.errors.invalidExtId.length == 0

    return result
}
