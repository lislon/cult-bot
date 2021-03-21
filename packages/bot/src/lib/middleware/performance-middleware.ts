import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { performance } from 'perf_hooks'
import * as tt from 'telegraf/typings/telegram-types'
import { ExtraEditMessageText, InlineKeyboardButton, InlineKeyboardMarkup } from 'telegraf/typings/telegram-types'
import d from 'debug'
import { cleanFromEmojis } from '../../util/string-utils'
const debug = d('bot:msg')

export class PerformanceContext {
    public timeBeforeFirstMsg?: number // time to message
    public scene?: string

    constructor(public readonly start: number) {
    }

    public getFromStart(): number {
        return performance.now() - this.start
    }
}

function recordFirstResponse(ctx: ContextMessageUpdate): void {
    if (ctx.perf.timeBeforeFirstMsg === undefined) {
        ctx.perf.timeBeforeFirstMsg = performance.now()
        ctx.perf.scene = ctx.scene?.current?.id
    }
}

function formatShortMsg(text: string): string {
    const lines = text.split('\n')
    return lines[0] + (lines.length > 1 ? ` (+ ${lines.length} lines)` : '')
}

function getButtonsAsText(replyMarkup?: InlineKeyboardMarkup): string {
    const existingKeyboard = replyMarkup?.inline_keyboard as InlineKeyboardButton.CallbackButton[][]
    if (existingKeyboard !== undefined) {
        return existingKeyboard
            .flatMap(btns => btns)
            .map(btn => btn.text)
            .map(cleanFromEmojis)
            .map(text => `[${text.trim()}]`)
            .join(' ')
    }
    return undefined;
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
            if (debug.enabled) {
                debug(`replying with '%s'`, formatShortMsg(text))
            }
            const res = origCtx.reply.apply(ctx, [text, extra])
            return res
        }
        ctx.editMessageText = (text: string, extra?: ExtraEditMessageText) => {
            recordFirstResponse(ctx)
            if (debug.enabled) {
                debug(`editing [%s] text='%s' btns='%s'`, ctx.callbackQuery?.message?.message_id, formatShortMsg(text), getButtonsAsText(extra.reply_markup))
            }

            const res = origCtx.editMessageText.apply(ctx, [text, extra])
            return res
        }
        ctx.editMessageReplyMarkup = (markup?: InlineKeyboardMarkup) => {
            recordFirstResponse(ctx)
            if (debug.enabled) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                debug(`editing buttons msg_id=%d buttons='%s'`, getButtonsAsText(ctx, (ctx as unknown).update?.callback_query?.message?.reply_markup))
            }
            return origCtx.editMessageReplyMarkup.apply(ctx, [markup])
        }
        await next()
    }
}

export function getResponsePerformance(ctx: ContextMessageUpdate) {
    return performance.now() - ctx.perf.start
}