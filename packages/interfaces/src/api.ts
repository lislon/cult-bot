import { EventCategory } from './index'

export interface MatchingSearchEvent {
    id: string
    title: string
    category: EventCategory
}

export interface MatchingFoundEvent {
    id: string
    extIds: string[]
}

export interface FindMatchingEventRequest {
    events: MatchingSearchEvent[]
}

export interface FindMatchingEventResponse {
    events: MatchingFoundEvent[]
}