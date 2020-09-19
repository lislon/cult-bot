import { Event } from './app-interfaces'
import { EventTimetable, MomentIntervals } from '../lib/timetable/intervals'

export interface DbEvent {
    category: string
    subcategory: string
    title: string
    place: string
    address: string
    timetable: string
    duration: string
    price: string
    notes: string
    description: string
    url: string
    tag_level_1: string
    tag_level_2: string
    tag_level_3: string
    rating: number
    reviewer: string
    is_anytime: boolean
}

export interface EventToSave {
    primaryData: Event
    timetable: EventTimetable
    timeIntervals: MomentIntervals
}