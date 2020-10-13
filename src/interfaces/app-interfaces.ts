import { SceneContextMessageUpdate } from 'telegraf/typings/stage'
import { I18n } from 'telegraf-i18n'
import { TimetableSceneState } from '../scenes/timetable/timetable-scene'
import { CustomizeSceneState } from '../scenes/customize/customize-scene'
import { TimeIntervalSceneState } from '../scenes/time-interval/time-interval-scene'
import { AdminSceneState } from '../scenes/admin/admin-scene'
import * as tt from 'telegraf/typings/telegram-types'
import { PacksSceneState } from '../scenes/packs/packs-scene'
import { PagingState } from '../scenes/shared/paging'
import { SearchSceneState } from '../scenes/search/search-scene'


export type EventCategory = 'theaters' | 'exhibitions' | 'movies' | 'events' | 'walks' | 'concerts'
export const allCategories: EventCategory[] = ['theaters', 'exhibitions', 'movies', 'events', 'walks', 'concerts']

export type TagLevel2 = '#сдетьми0+'
    | '#сдетьми6+'
    | '#сдетьми12+'
    | '#сдетьми16+'
    | '#ЗОЖ'
    | '#комфорт'
    | 'премьера'
    | '#доступноподеньгам'
    | '#бесплатно'


export const chidrensTags: TagLevel2[] = ['#сдетьми0+', '#сдетьми6+', '#сдетьми12+', '#сдетьми16+']
export type EventFormat = 'online' | 'outdoor' | undefined

export interface ContextMessageUpdate extends SceneContextMessageUpdate {
    i18n: I18n
    session: {
        packsScene: PacksSceneState
        search: SearchSceneState
        customize: CustomizeSceneState
        timetable: TimetableSceneState
        timeInterval: TimeIntervalSceneState
        adminScene: AdminSceneState
        paging: PagingState
        language: 'en' | 'ru'
        sceneStack: string[]
        user: tt.User
    }
    webhookReply: boolean
    now(): Date
    isNowOverridden(): boolean
}

export interface Event {
    category: string
    publish: string
    subcategory: string
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
}

export type MyInterval = {
    start: Date
    end: Date
}