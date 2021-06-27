import { User } from 'typegram'
import { ContextMessageUpdate } from '../interfaces/app-interfaces'

export function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
    return !(value === null || value === undefined)
}

export function fieldIsQuestionMarkOrEmpty(str: string): boolean {
    return str === undefined || str.trim() === '???' || str.trim() === ''
}

export function formatUserName(ctx: ContextMessageUpdate): string {
    return ctx.from ? formatUserName2(ctx.from) : ''
}

export function formatUserName2(user: User): string {
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