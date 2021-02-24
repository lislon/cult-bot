import { User } from 'telegraf/typings/telegram-types'
import { ContextMessageUpdate } from '../interfaces/app-interfaces'

export function fieldIsQuestionMarkOrEmpty(str: string) {
    const trim = str.trim()
    return trim === '???' || trim === ''
}

export function formatUserName(ctx: ContextMessageUpdate) {
    return formatUserName2(ctx.from)
}

export function formatUserName2(user: User) {
    const result: string[] = []
    if (user.first_name) {
        result.push(user.first_name)
    }
    if (user.last_name) {
        result.push(user.last_name)
    }
    if (user.username) {
        result.push(`@${user.username}`)
    }
    if (result.length === 0) {
        result.push(`Аноним (id=${user.id})`)
    }

    return result.join(' ')
}