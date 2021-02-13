import { EventCategory } from '../interfaces/app-interfaces'

export function cleanTagLevel1(text: string): string {
    // tag[cat] -> tag
    return text.replace(/^[^.]+[.]/, '')
}

export function encodeTagsLevel1(cat: EventCategory, tagsLevel1: string[]): string[] {
    return tagsLevel1.map(tag => `${cat}.${tag}`)
}

export function decodeTagsLevel1(tagsLevel1: string[]): string[] {
    return tagsLevel1.map(tag => tag.replace(/^[^.][.]/, ''))
}