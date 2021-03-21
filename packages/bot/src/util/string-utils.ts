import emojiRegex from 'emoji-regex'

export const escapeHTML = (string: string): string => {
    return string
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

export function cleanFromEmojis(str: string): string {
    return str
        .replace(emojiRegex(), '')
        .replace(/[🏛]/g, '')
        .replace(/\[\s+/g, '[')
        .replace(/\s]+/g, ']')
        .replace(/(?<=<[^/>]+>)\s+/g, '')
}