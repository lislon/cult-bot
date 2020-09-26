import { SceneContextMessageUpdate } from 'telegraf/typings/stage'
import { I18n } from 'telegraf-i18n'
import { TimetableSceneState } from '../scenes/timetable/timetable-scene'
import { CustomizeSceneState } from '../scenes/customize/customize-scene'
import { TimeIntervalSceneState } from '../scenes/time-interval/time-interval-scene'
import { MainSceneState } from '../scenes/main/main-scene'
import { AdminSceneState } from '../scenes/admin/admin-scene'

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
export const moneyTags: TagLevel2[] = ['#сдетьми0+', '#сдетьми6+', '#сдетьми12+', '#сдетьми16+']

export interface ContextMessageUpdate extends SceneContextMessageUpdate {
    i18n: I18n
    session: {
        mainScene: MainSceneState
        customize: CustomizeSceneState
        timetable: TimetableSceneState
        timeInterval: TimeIntervalSceneState
        adminScene: AdminSceneState
        language: 'en' | 'ru'
        sceneStack: string[]
    }
    webhookReply: boolean;
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