import { SceneContextMessageUpdate } from 'telegraf/typings/stage'
import { I18n } from 'telegraf-i18n'
import { TimetableSceneState } from '../scenes/timetable/timetable-scene'
import { CustomizeSceneState } from '../scenes/customize/customize-scene'
import { TimeIntervalSceneState } from '../scenes/time-interval/time-interval-scene'
import { AdminSceneState } from '../scenes/admin/admin-scene'
import { TopsSceneState } from '../scenes/tops/tops-scene'
import { PagingState } from '../scenes/shared/paging'
import { SearchSceneState } from '../scenes/search/search-scene'
import { Visitor } from 'universal-analytics'
import { PerformanceContext } from '../lib/middleware/performance-middleware'
import { FeedbackSceneState } from '../scenes/feedback/feedback-scene'
import { AnalyticsState, AnalyticsStateTmp } from '../lib/middleware/analytics-middleware'
import { UserState } from '../lib/middleware/user-middleware'
import { HelpSceneState } from '../scenes/help/help-scene'
import { PacksSceneState } from '../scenes/packs/packs-common'
import { FavoritesState } from '../scenes/favorites/favorites-scene'


export type EventCategory = 'theaters' | 'exhibitions' | 'movies' | 'events' | 'walks' | 'concerts'
export const allCategories: EventCategory[] = ['theaters', 'exhibitions', 'movies', 'events', 'walks', 'concerts']

export type TagLevel2 = '#сдетьми0+'
    | '#сдетьми6+'
    | '#сдетьми12+'
    | '#сдетьми16+'
    | '#ЗОЖ'
    | '#комфорт'
    | '#премьера'
    | '#доступноподеньгам'
    | '#бесплатно'
    | '#_недешево'

export const moneyTags: TagLevel2[] = ['#доступноподеньгам', '#бесплатно', '#_недешево']
export const chidrensTags: TagLevel2[] = ['#сдетьми0+', '#сдетьми6+', '#сдетьми12+', '#сдетьми16+']
export type EventFormat = 'online' | 'outdoor' | undefined

export interface ContextMessageUpdate extends SceneContextMessageUpdate {
    i18n: I18n
    sessionTmp: {
        analyticsScene: AnalyticsStateTmp
    },
    session: {
        topsScene: TopsSceneState
        packsScene: PacksSceneState
        search: SearchSceneState
        customize: CustomizeSceneState
        timetable: TimetableSceneState
        timeInterval: TimeIntervalSceneState
        adminScene: AdminSceneState
        feedbackScene: FeedbackSceneState
        favorites: FavoritesState
        analytics: AnalyticsState,
        paging: PagingState
        user: UserState
        help: HelpSceneState,
        language: 'en' | 'ru'
    }
    webhookReply: boolean
    ua: Visitor
    perf: PerformanceContext
    now(): Date
    isNowOverridden(): boolean
}

export interface Event {
    id?: number
    ext_id: string
    category: EventCategory
    publish: string
    title: string
    place: string
    address: string
    geotag: string
    timetable: string
    duration: string
    price: string
    notes: string
    description: string
    url: string
    tag_level_1: string[]
    tag_level_2: string[]
    tag_level_3: string[]
    rating: number
    reviewer: string
    likes: number
    dislikes: number
}

export type MyInterval = {
    start: Date
    end: Date
}

export type I18MsgFunction = (ctx: ContextMessageUpdate, id: string, tplData?: object, byDefault?: string | null) => string
export const CHEAP_PRICE_THRESHOLD = 500

export const CAT_NAMES = {
    'theaters': 'Театр',
    'exhibitions': 'Выставки',
    'concerts': 'Концерты',
    'events': 'Мероприятия',
    'movies': 'Кино',
    'walks': 'Прогулки'
}

export type ExtIdAndId = { id: number; extId: string }

export type ExtIdAndMaybeId = { id?: number; extId: string }