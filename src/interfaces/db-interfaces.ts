import { Event } from './app-interfaces'
import { EventTimetable, MomentIntervals } from '../lib/timetable/intervals'

export interface DbEvent {
    category: string
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
    is_anytime: boolean
    order_rnd: number
    ext_id: string
    updated_at: Date,
    deleted_at: Date | null
    likes_fake: number
    dislikes_fake: number
}

export interface EventToSave {
    primaryData: Event
    timetable: EventTimetable
    timeIntervals: MomentIntervals
    is_anytime: boolean
    order_rnd?: number
    dateDeleted?: Date | null
    popularity: number
    fakeLikes: number
    fakeDislikes: number
}

export type TagCategory = 'tag_level_1' | 'tag_level_2' | 'tag_level_3'

export interface Tag {
    category: TagCategory
    name: string
}
