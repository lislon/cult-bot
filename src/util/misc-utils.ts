import { ContextMessageUpdate } from '../interfaces/app-interfaces'

export function fieldIsQuestionMarkOrEmpty(str: string) {
    const trim = str.trim()
    return trim === '???' || trim === ''
}

export function formatUserName(ctx: ContextMessageUpdate) {
    const from = ctx.from

    const result: string[] = []
    if (from.first_name) {
        result.push(from.first_name)
    }
    if (from.last_name) {
        result.push(from.last_name)
    }
    if (from.username) {
        result.push(`@${from.username}`)
    }
    if (result.length === 0) {
        result.push(`Аноним (id=${ctx.from.id})`)
    }

    return result.join(' ')
}