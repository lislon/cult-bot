import { ContextMessageUpdate } from '../interfaces/app-interfaces'
import { adminIds, adminUsernames, devUsernames } from './admins-list'
import * as tt from 'telegraf/src/telegram-types'
import { MAX_TELEGRAM_MESSAGE_LENGTH } from './bot-config'
import { chunkanize } from '../scenes/shared/shared-logic'
import { InlineKeyboardButton } from 'typegram'
import CallbackButton = InlineKeyboardButton.CallbackButton

export function sleep(ms: number): Promise<unknown> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

export function isDev(ctx: ContextMessageUpdate): boolean {
    return devUsernames.includes(ctx.from?.username || '')
}

export function isAdmin(ctx: ContextMessageUpdate): boolean {
    return adminUsernames.includes(ctx.from?.username || '') || adminIds.includes(ctx.from?.id || 0)
}

export function isPaidUser(ctx: ContextMessageUpdate): boolean {
    return ctx.session.user.isPaid
}

export async function ifAdmin<T>(ctx: ContextMessageUpdate, callback: () => Promise<T>): Promise<T | undefined> {
    if (isAdmin(ctx)) {
        return await callback()
    } else {
        await ctx.replyWithHTML(ctx.i18n.t('shared.no_admin'))
    }
}

export function findInlineBtnTextByCallbackData(ctx: ContextMessageUpdate, callbackData: string): string | undefined {
    return (ctx as any)?.update?.callback_query?.message?.reply_markup?.inline_keyboard
        .flatMap((r: InlineKeyboardButton[]) => r)
        .find((btn: CallbackButton) => 'callback_data' in btn && btn.callback_data === callbackData)
        ?.text || undefined
}

export async function sendLongMessage(ctx: ContextMessageUpdate, chatId: number | string,
                                      text: string,
                                      extra?: tt.ExtraReplyMessage, maxLen: number = MAX_TELEGRAM_MESSAGE_LENGTH) {

    return await chunkanize(text, async (text, msgExtra) => await ctx.telegram.sendMessage(chatId, text, extra), extra, maxLen)
}