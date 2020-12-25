declare module 'telegraf/core/network/error' {

    export class TelegramError extends Error {
        // TODO: Learn how to create correct typings
        // constructor(payload: { error_code: string, description: string }, on?: any)
        constructor(q: any)

        code: number
        response: any
        description: string
    }
}