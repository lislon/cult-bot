import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { performance } from 'perf_hooks'
import * as tt from 'telegraf/typings/telegram-types'

export class PerformanceContext {
    public timeBeforeFirstMsg?: number // time to message
    constructor(public readonly start: number) {
    }

    public getFromStart(): number {
        return performance.now() - this.start
    }
}

export function performanceMiddleware(prefix: string) {
    return async (ctx: ContextMessageUpdate, next: any) => {
        ctx.perf = new PerformanceContext(performance.now())

        const origReply = ctx.reply;
        ctx.reply = (text: string, extra?: tt.ExtraReplyMessage) => {
            if (ctx.perf.timeBeforeFirstMsg === undefined) {
                ctx.perf.timeBeforeFirstMsg = performance.now()
            }
            return origReply.apply(ctx, [text, extra])
        }
        await next()
    }
}

export function getResponsePerformance(ctx: ContextMessageUpdate) {
    return performance.now() - ctx.perf.start
}