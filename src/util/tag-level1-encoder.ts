import { EventCategory } from '../interfaces/app-interfaces'

export function cleanTagLevel1(text: string) {
    // tag[cat] -> tag
    return text.replace(/^[^.]+[.]/, '')
}

export function encodeTagsLevel1(cat: EventCategory, tagsLevel1: string[]): string[] {
    return tagsLevel1.map(tag => `${cat}.${tag}`)
}