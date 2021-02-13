import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { performance } from 'perf_hooks'
import * as tt from 'telegraf/typings/telegram-types'
import { ExtraEditMessageText, InlineKeyboardMarkup } from 'telegraf/typings/telegram-types'

export class PerformanceContext {
    public timeBeforeFirstMsg?: number // time to message
    public scene?: string

    constructor(public readonly start: number) {
    }

    public getFromStart(): number {
        return performance.now() - this.start
    }
}

function recordFirstResponse(ctx: ContextMessageUpdate) {
    if (ctx.perf.timeBeforeFirstMsg === undefined) {
        ctx.perf.timeBeforeFirstMsg = performance.now()
        ctx.perf.scene = ctx.scene?.current?.id
    }
}

export function performanceMiddleware(prefix: string) {
    return async (ctx: ContextMessageUpdate, next: any) => {
        ctx.perf = new PerformanceContext(performance.now())
        const origCtx = {
            reply: ctx.reply,
            editMessageText: ctx.editMessageText,
            editMessageReplyMarkup: ctx.editMessageReplyMarkup
        }
        ctx.reply = (text: string, extra?: tt.ExtraReplyMessage) => {
            recordFirstResponse(ctx)
            return origCtx.reply.apply(ctx, [text, extra])
        }
        ctx.editMessageText = (text: string, extra?: ExtraEditMessageText) => {
            recordFirstResponse(ctx)
            return origCtx.editMessageText.apply(ctx, [text, extra])
        }
        ctx.editMessageReplyMarkup = (markup?: InlineKeyboardMarkup) => {
            recordFirstResponse(ctx)
            return origCtx.editMessageReplyMarkup.apply(ctx, [markup])
        }
        await next()
    }
}

export function getResponsePerformance(ctx: ContextMessageUpdate) {
    return performance.now() - ctx.perf.start
}