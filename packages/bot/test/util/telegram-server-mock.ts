import { InlineKeyboardButton, KeyboardButton, Message, Update } from 'typegram'
import { ExtraReplyMessage } from 'telegraf/typings/telegram-types'
import { ContextMessageUpdate } from '../../src/interfaces/app-interfaces'
import { MiddlewareFn, Telegraf } from 'telegraf'
import { MarkupHelper } from '../features/lib/MarkupHelper'
import { MOCK_CHAT_ID } from './telegram-mock-common'
import { TelegramCtxMock } from './telegram-ctx-mock'
import { makeCommand, makeDefaultUpdateEvent, makeInlineClick, makeMessageUpdate } from './telegram-mock-update'
import TextMessage = Message.TextMessage
import CallbackButton = InlineKeyboardButton.CallbackButton
import CommonButton = KeyboardButton.CommonButton
import { reverse } from 'lodash'

export type MessageWithInlineMarkup = Message.CommonMessage

export class TelegramServerMock {
    // private currentScene = ''
    private repliesIterIndex = {index: 0}
    private repliesIterIndexOtherChat = {index: 0}
    private lastCtx: TelegramCtxMock

    ctx(): ContextMessageUpdate {
        return this.lastCtx
    }

    replyIterator(): Iterator<BotReply> {
        return this.makeIteratorWithFilter((r) => r.message.chat.id === MOCK_CHAT_ID, this.repliesIterIndex)
    }

    replyIteratorOtherChat(): Iterator<BotReply> {
        return this.makeIteratorWithFilter((r) => r.message.chat.id !== MOCK_CHAT_ID, this.repliesIterIndexOtherChat)
    }

    private makeIteratorWithFilter(predicate: (reply: BotReply) => boolean, lastElement: { index: number }): Iterator<BotReply> {
        return {
            next: () => {
                const nextMessageWithSameChatId = (r: BotReply, index: number) =>
                    index >= lastElement.index && predicate(r)

                const foundIndex = (this.lastCtx?.getReplies() || []).findIndex(nextMessageWithSameChatId)
                if (foundIndex >= 0) {
                    lastElement.index = foundIndex + 1
                    return {
                        done: false,
                        value: this.lastCtx.getReplies()[foundIndex]
                    }
                } else {
                    return {
                        done: true,
                        value: undefined
                    }
                }
            }
        }
    }

    getLastCbQuery(): string | true {
        return this.lastCtx.getLastCbReply()
    }

    getLastEditedInline(): BotReply {
        return this.lastCtx.getLastEdited()
    }

    async sendInitialUpdate(middleware: MiddlewareFn<ContextMessageUpdate>) {
        this.lastCtx = TelegramCtxMock.createFromInitialUpdate().continueServerStateFrom(this.lastCtx)
        await middleware(this.lastCtx, () => Promise.resolve())
    }

    async enterScene(bot: Telegraf<ContextMessageUpdate>, sceneId: string) {
        this.lastCtx = TelegramCtxMock.createFromInitialUpdate().continueServerStateFrom(this.lastCtx)
        try {
            await bot.middleware()(this.lastCtx, async () => {
                await this.lastCtx.scene.enter(sceneId)
            })
        } catch (e) {
            await (bot as any).handleError(e, this.lastCtx)
        }
    }


    async sendMessage(bot: Telegraf<ContextMessageUpdate>, text: string) {
        this.lastCtx = TelegramCtxMock.createTextReply(text).continueServerStateFrom(this.lastCtx)
        try {
            await bot.middleware()(this.lastCtx, () => Promise.resolve())
        } catch (e) {
            // await (bot as any).handleError(e, this.lastCtx)
            console.log('ok')
        }
    }

    async clickInline(bot: Telegraf<ContextMessageUpdate>, callbackData: string, message: Message) {
        this.lastCtx = TelegramCtxMock.createFromInlineClick(callbackData, message).continueServerStateFrom(this.lastCtx)
        this.lastCtx.resetCbQuery()

        try {
            await bot.middleware()(this.lastCtx, undefined)
        } catch (e) {
            await (bot as any).handleError(e, this.lastCtx)
            return
        }
        if (this.lastCtx.getLastCbReply() === undefined) {
            throw new Error('Bad behaviour! Missing cbQuery call after action')
        }
    }

    async start(bot: Telegraf<ContextMessageUpdate>, payload: string) {
        this.lastCtx = TelegramCtxMock.createTextReply('/start', payload).continueServerStateFrom(this.lastCtx)
        await bot.middleware()(this.lastCtx, undefined)
    }

    getListOfInlineButtonsFromLastMsg(): { message: TextMessage, buttons: CallbackButton[] } {
        for (const botReply of reverse(this.lastCtx.getReplies())) {
            if (MarkupHelper.isInlineKeyboard(botReply.extra?.reply_markup)) {
                return {
                    message: botReply.message,
                    buttons: MarkupHelper.listInlineButtons(botReply.extra.reply_markup)
                }
            }
        }
        return {message: undefined, buttons: []}
    }

    getListOfMarkupButtonsFromLastMsg(): { message: MessageWithInlineMarkup, buttons: CommonButton[] } {
        for (const botReply of reverse(this.lastCtx.getReplies())) {
            if (MarkupHelper.isMarkupKeyboard(botReply.extra?.reply_markup)) {
                return {
                    message: botReply.message,
                    buttons: MarkupHelper.listMarkupButtons(botReply.extra.reply_markup)
                }
            }
        }
        return {message: undefined, buttons: []}
    }

    blockBotByUser() {
        this.lastCtx.botIsBlocked = true
    }
}

export interface BotReply {
    message: Message.TextMessage
    text: string
    extra?: ExtraReplyMessage
}

