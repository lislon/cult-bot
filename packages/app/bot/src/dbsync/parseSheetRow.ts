import { EventNoId, TagLevel2 } from '../interfaces/app-interfaces'
import { EventCategory } from '@culthub/interfaces'
import { fieldIsQuestionMarkOrEmpty } from '../util/misc-utils'
import { parseAndPredictTimetable } from '../lib/timetable/timetable-utils'
import { i18n } from '../util/i18n'
import { parseISO } from 'date-fns'
import { botConfig } from '../util/bot-config'
import { EventTimetable, MomentOrInterval } from '@culthub/timetable'
import debugNamespace from 'debug'
import { enrichEventWithAutotags, ErrorCallback } from '../core/event-post-sync-enrich'
import { EventDuration, parseDuration } from '../lib/duration-parser'

const debug = debugNamespace('parse-excel')

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
    popularity: 'Популярность',
    fake_likes: 'Лайки',
    fake_dislikes: 'Дизлайки',
    due_date: 'Due date',
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

export type Popularity = 1 | 2 | 3


export interface ExcelEventRow {
    valid: boolean,
    publish: boolean,
    errors?: {
        timetable?: string[],
        duration?: string[],
        emptyRows?: ExcelColumnNameEvents[],
        extId?: string[],
        tagLevel1?: string[]
        tagLevel2?: string[]
        tagLevel3?: string[]
    }
    warnings?: {
        tagLevel2?: string[]
    }
    parsedTimetable?: EventTimetable,
    predictedIntervals: MomentOrInterval[]
    parsedDuration: EventDuration
    rowNumber: number
    data: EventNoId
    dueDate: Date
    popularity?: Popularity
    fakeLikes?: number
    fakeDislikes?: number
}

function preparePublish(data: EventNoId, result: ExcelEventRow) {
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

export function hasHumanTimetable(timetable: string): boolean {
    return !!timetable.match(/{(?:бот|bot):([^}]+)}/)
}

export function getOnlyHumanTimetable(timetable: string): string {
    return timetable.replace(/{(?:бот|bot):([^}]+)}/, '').trim()
}

function validateTagLevel1(event: EventNoId, errorCallback: ErrorCallback) {
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

function validateNonEmptyTags(tags: string[], errorCallback: ErrorCallback) {
    if (tags.length === 0) {
        errorCallback(['В боте получиться пустой тег'])
    }
}

function validateTagSymbols(tags: string[], errorCallback: ErrorCallback) {
    if (tags.join('') !== '') {
        const badTag = tags.find(t => t.match(/^#[^_\s#?@$%^&*()!\\№:;',-]+$/) === null)
        if (badTag !== undefined) {
            errorCallback([`Плохой тег ${badTag}`])
        }
    }
}


function isAddressValid(data: EventNoId) {
    return !(data.address.toLowerCase() === 'онлайн' && data.address.toLowerCase() !== data.address)
}

function validateExtId(data: EventNoId, errorCallback: ErrorCallback): void {
    const extId = data.extId
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
    if (extId.trim() === '') {
        return errorCallback(['Пустой extId'])
    }
}

export function processExcelRow(row: Partial<ExcelRowEvents>, category: EventCategory, now: Date, rowNumber: number): ExcelEventRow {

    const notNull = (s: string) => s === undefined ? '' : s.trim()
    const notNullOrUnknown = (s: string) => s === undefined ? '' : s
    const forceDigit = (n: string, def = 0) => n === undefined ? def : +n
    const splitTags = (s: string) => s.split(/\s+|(?<=[^\s])(?=#)/).filter(s => s !== '')

    const data: EventNoId = {
        'extId': row.ext_id,
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
        'tag_level_2': splitTags(notNull(row.tag_level_2)) as TagLevel2[],
        'tag_level_3': splitTags(notNull(row.tag_level_3)),
        'rating': forceDigit(row.rating),
        'reviewer': notNull(row.reviewer),
        'likes': 0,
        'dislikes': 0
    }

    debug(`Preparing ${row.ext_id}`)

    const result: ExcelEventRow = {
        valid: true,
        publish: true,
        errors: {
            emptyRows: [],
            tagLevel1: [],
            tagLevel2: [],
            tagLevel3: [],
            extId: [],
        },
        warnings: {
            tagLevel2: []
        },
        dueDate: notNull(row.due_date) ? parseISO(notNull(row.due_date)) : undefined,
        predictedIntervals: [],
        parsedDuration: 'unknown',
        rowNumber,
        data,
        popularity: row.popularity === '' ? undefined : +row.popularity as Popularity,
        fakeLikes: row.fake_likes === '' || row.fake_likes === undefined ? undefined : +(row.fake_likes.replace(/\D/g, '')),
        fakeDislikes: row.fake_dislikes === '' || row.fake_dislikes === undefined ? undefined : +(row.fake_dislikes.replace(/\D/g, ''))
    }
    const predictTimetableResult = parseAndPredictTimetable(data.timetable, now, botConfig)

    result.predictedIntervals = predictTimetableResult.predictedIntervals
    result.parsedTimetable = predictTimetableResult.parsedTimetable

    if (predictTimetableResult.errors.length > 0) {
        result.valid = false
        result.errors.timetable = predictTimetableResult.errors
    }
    const x = parseDuration(data.duration)
    if (x.status === true) {
        result.parsedDuration = x.value
    } else {
        result.parsedDuration = 'unknown'
        if (data.duration !== '') {
            result.valid = false
            result.errors.duration = [...x.expected, 'Подробнее: https://www.notion.so/1a7d4f74064e4f9da5ce8e9d18c785ba']
        }
    }


    result.publish = preparePublish(data, result)

    if (!isAddressValid(data)) {
        result.errors.emptyRows.push('address')
    }

    validateExtId(data, (errors) => result.errors.extId = errors)

    validateTagSymbols(data.tag_level_1, (errors) => result.errors.tagLevel1 = [...result.errors.tagLevel1, ...errors])
    validateTagSymbols(data.tag_level_2, (errors) => result.errors.tagLevel2 = [...result.errors.tagLevel2, ...errors])
    validateTagSymbols(data.tag_level_3, (errors) => result.errors.tagLevel3 = [...result.errors.tagLevel3, ...errors])
    validateTagLevel1(data, (errors) => result.errors.tagLevel1 = [...result.errors.tagLevel1, ...errors])

    result.data = enrichEventWithAutotags(result.data, {
            errorCallback: (errors) => result.errors.tagLevel2 = [...result.errors.tagLevel2, ...errors],
            warningCallback: (warnings) => result.warnings.tagLevel2 = [...result.warnings.tagLevel2, ...warnings],
            parsedTimetable: result.parsedTimetable,
            predictedIntervals: result.predictedIntervals,
            parsedDuration: result.parsedDuration,
            now
        }
    )

    validateNonEmptyTags(data.tag_level_1, (errors) => result.errors.tagLevel1 = [...result.errors.tagLevel1, ...errors])
    validateNonEmptyTags(data.tag_level_2, (errors) => result.errors.tagLevel2 = [...result.errors.tagLevel2, ...errors])
    validateNonEmptyTags(data.tag_level_3, (errors) => result.errors.tagLevel3 = [...result.errors.tagLevel3, ...errors])

    result.valid = result.valid && result.errors.emptyRows.length == 0
    result.valid = result.valid && result.errors.tagLevel1.length == 0
    result.valid = result.valid && result.errors.tagLevel2.length == 0
    result.valid = result.valid && result.errors.tagLevel3.length == 0
    result.valid = result.valid && result.errors.extId.length == 0

    return result
}
