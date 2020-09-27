import { Event } from '../interfaces/app-interfaces'

export function cleanTagLevel1(text: string) {
    // tag[cat] -> tag
    return text.replace(/^[^.]+[.]/, '')
}

export function encodeTagLevel1(event: Pick<Event, 'category' | 'tag_level_1'>) {
    return event.tag_level_1.map(tag => `${event.category}.${tag}`)
}