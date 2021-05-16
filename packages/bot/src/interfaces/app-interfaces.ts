import { I18n } from 'telegraf-i18n'
import { AdminSceneState } from '../scenes/admin/admin-scene'
import { SearchSceneState } from '../scenes/search/search-scene'
import { Visitor } from 'universal-analytics'
import { PerformanceContext } from '../lib/middleware/performance-middleware'
import { FeedbackSceneState } from '../scenes/feedback/feedback-scene'
import { AnalyticsState, AnalyticsStateTmp } from '../lib/middleware/analytics-middleware'
import { UserState, UserStateTmp } from '../lib/middleware/user-middleware'
import { HelpSceneState } from '../scenes/help/help-scene'
import { PacksSceneState } from '../scenes/packs/packs-common'
import { AllSlidersState } from '../scenes/shared/slider-pager'
import { CustomizeSceneState } from '../scenes/customize/customize-common'
import { PagingState } from '../scenes/shared/paging-pager'
import { TopsSceneState } from '../scenes/tops/tops-common'
import { Logger } from 'winston'
import { Context, Scenes } from 'telegraf'
import { EventCategory } from '@culthub/interfaces'

export type TagLevel2 = '#компанией'
    | '#сдетьми0+'
    | '#сдетьми6+'
    | '#сдетьми12+'
    | '#сдетьми16+'
    | '#комфорт'
    | '#новыеформы'
    | '#бесплатно'
    | '#доступноподеньгам'
    | '#успетьзачас'
    | '#навоздухе'
    | '#премьера'
    | '#культурныйбазис'
    | '#_недешево'
    | '#последнийшанс'  // for permanent marker in db
    | '#_последнийшанс'


export const moneyTags: TagLevel2[] = ['#доступноподеньгам', '#бесплатно', '#_недешево']
export const chidrensTags: TagLevel2[] = ['#сдетьми0+', '#сдетьми6+', '#сдетьми12+', '#сдетьми16+']
export type EventFormat = 'online' | 'outdoor' | undefined

export interface MySession extends Scenes.SceneSession<Scenes.SceneSessionData> {
    topsScene?: TopsSceneState
    packsScene?: PacksSceneState
    search?: SearchSceneState
    customize?: CustomizeSceneState
    adminScene?: AdminSceneState
    feedbackScene?: FeedbackSceneState
    analytics?: AnalyticsState,
    user: UserState
    help?: HelpSceneState,
    paging?: PagingState<unknown>
    slider?: AllSlidersState
    language?: 'en' | 'ru'
}

export interface ContextMessageUpdate extends Context {
    session: MySession
    scene: Scenes.SceneContextScene<ContextMessageUpdate>
    i18n: I18n
    sessionTmp: {
        analyticsScene: AnalyticsStateTmp
        userScene: UserStateTmp
    },
    logger: Logger
    webhookReply: boolean
    ua: Visitor
    perf: PerformanceContext

    now(): Date

    isNowOverridden(): boolean
}

export interface EventNoId {
    extId: string
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
    tag_level_2: TagLevel2[]
    tag_level_3: string[]
    rating: number
    reviewer: string
    likes: number
    dislikes: number
}

export interface Event extends EventNoId{
    id: number
}

export type DateInterval = {
    start: Date
    end: Date
}

export type I18MsgFunction = (ctx: ContextMessageUpdate, id: string, tplData?: any, byDefault?: string | null) => string
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
export type ContextCallbackQueryUpdate = ContextMessageUpdate & {
    update: {
        callback_query: any
    }
}