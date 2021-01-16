import { Context, Telegraf, Telegram } from 'telegraf'
import * as tt from 'telegraf/typings/telegram-types'
import { Update } from 'telegraf/typings/telegram-types'
import { ContextMessageUpdate } from '../../../src/interfaces/app-interfaces'
import { InlineKeyboardButton, InlineKeyboardMarkup, KeyboardButton, Message } from 'telegram-typings'
import { MiddlewareFn } from 'telegraf/typings/composer'
import { MarkupHelper } from './MarkupHelper'

const TelegramError = require('telegraf/core/network/error') as any


const CHAT_ID = 1234
const FROM_ID = 7777

interface MessageWithInlineMarkup extends Message {
    reply_markup?: InlineKeyboardMarkup
}

const CHAT = {
    id: CHAT_ID,
    type: 'private'
}

function makeFrom() {
    return {
        from: {
            id: FROM_ID,
            first_name: 'TestFirstName',
            last_name: 'Ber',
            is_bot: false
        }
    }
}

function makeMessage(text: string = undefined, override: Partial<Message> = {}): { message: Message } {
    return {
        message: {
            ...makeFrom(),
            date: new Date().getTime(),
            message_id: 0,
            text: text,
            chat: CHAT,
            ...override
        }
    }
}

function makeCommand(command: string, payload: string = ''): { message: Message } {
    return {
        ...makeMessage([command, payload].join(' '), {
            entities: [ {
                offset: 0,
                type: 'bot_command',
                length: command.length
            } ]
        })
    }
}

const makeDefaultEvent = (content: Partial<Update>) => {
    return {
        ...content,
        update_id: 0
    }
}

export class TelegramMockServer {
    // private currentScene = ''
    private replies: BotReply[] = []
    private repliesIterIndex = { index: 0 }
    private repliesIterIndexOtherChat = { index: 0 }
    private lastMsg: MessageWithInlineMarkup
    private lastEdited: BotReply
    private lastMsgId = 0;
    private lastCtx: ContextMessageUpdate
    private botIsBlocked = false
    private lastCbQuery: string|true = undefined

    ctx(): ContextMessageUpdate {
        return this.lastCtx
    }

    replyIterator(): Iterator<BotReply> {
        return this.makeIteratorWithFilter((r) => r.message.chat.id === CHAT_ID, this.repliesIterIndex)
    }

    replyIteratorOtherChat(): Iterator<BotReply> {
        return this.makeIteratorWithFilter((r) => r.message.chat.id !== CHAT_ID, this.repliesIterIndexOtherChat)
    }

    private makeIteratorWithFilter(predicate: (reply: BotReply) => boolean, lastElement: { index: number }) {
        return {
            next: () => {
                const nextMessageWithSameChatId = (r: BotReply, index: number) =>
                    index >= lastElement.index && predicate(r)

                const foundIndex = this.replies.findIndex(nextMessageWithSameChatId)
                if (foundIndex >= 0) {
                    lastElement.index = foundIndex + 1
                    return {
                        done: false,
                        value: this.replies[foundIndex]
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

    getLastCbQuery(): string {
        return this.lastCbQuery === true ? undefined : this.lastCbQuery
    }

    getLastEditedInline(): BotReply {
        return this.lastEdited
    }

    async sendInitialUpdate(middleware: MiddlewareFn<ContextMessageUpdate>) {
        this.lastCtx = this.prepareCtxFromServer(makeDefaultEvent({...makeMessage()}))
        await middleware(this.lastCtx, undefined)
    }

    async enterScene(bot: Telegraf<ContextMessageUpdate>, sceneId: string) {
        this.lastCtx = this.prepareCtxFromServer(makeDefaultEvent({...makeMessage()}))
        try {
            await bot.middleware()(this.lastCtx, async () => await this.lastCtx.scene.enter(sceneId))
        } catch (e) {
            await (bot as any).handleError(e, this.lastCtx)
        }
    }


    async sendMessage(bot: Telegraf<ContextMessageUpdate>, text: string) {
        if (text.startsWith('/')) {
            this.lastCtx = this.prepareCtxFromServer(makeDefaultEvent({...makeCommand(text)}))
        } else {
            this.lastCtx = this.prepareCtxFromServer(makeDefaultEvent({...makeMessage(text)}))
        }
        try {
            await bot.middleware()(this.lastCtx, undefined)
        } catch (e) {
            // await (bot as any).handleError(e, this.lastCtx)
            console.log('ok')
        }
    }

    async clickInline(bot: Telegraf<ContextMessageUpdate>, callbackData: string, message: Message) {
        this.lastCtx = this.prepareCtxFromServer(makeDefaultEvent({
            callback_query: {
                id: '0',
                ...makeFrom(),
                message: message,
                chat_instance: '0',
                data: callbackData
            }
        }))
        this.lastCbQuery = undefined
        try {
            await bot.middleware()(this.lastCtx, undefined)
        } catch (e) {
            await (bot as any).handleError(e, this.lastCtx)
            return
        }
        if (this.lastCbQuery === undefined) {
            throw new Error('cbQuery is empty after click')
        }
    }

    async start(bot: Telegraf<ContextMessageUpdate>, payload: string) {
        this.lastCtx = this.prepareCtxFromServer(makeDefaultEvent(makeCommand('/start', payload)))
        await bot.middleware()(this.lastCtx, undefined)
    }

    getListOfInlineButtonsFromLastMsg(): {message: MessageWithInlineMarkup, buttons: InlineKeyboardButton[]} {
        for (let i = this.replies.length - 1; i >= 0; i--) {
            if (MarkupHelper.isInlineKeyboard(this.replies[i].extra?.reply_markup)) {
                return {
                    message: this.replies[i].message,
                    buttons: MarkupHelper.listInlineButtons(this.replies[i].extra.reply_markup)
                }
            }
        }
        return { message: undefined, buttons: [] }
    }

    getListOfMarkupButtonsFromLastMsg(): { message: MessageWithInlineMarkup, buttons: KeyboardButton[] } {
        for (let i = this.replies.length - 1; i >= 0; i--) {
            if (MarkupHelper.isMarkupKeyboard(this.replies[i].extra?.reply_markup)) {
                return {
                    message: this.replies[i].message,
                    buttons: MarkupHelper.listMarkupButtons(this.replies[i].extra.reply_markup)
                }
            }
        }
        return { message: undefined, buttons: [] }
    }

    private prepareCtxFromServer(update: tt.Update): ContextMessageUpdate {
        const tg = new Telegram('', {})
        tg.callApi = async (method: any, data: { chat_id: number }): Promise<any> => {
            if (this.botIsBlocked) {
                throw new TelegramError({
                    error_code: 403,
                    description: 'bot was blocked by the user'
                })
            }
        }

        const ctx: ContextMessageUpdate = new Context(update, tg, {}) as ContextMessageUpdate

        async function touchApiMock() {
            await ctx.telegram.callApi('mock', {chat_id: 0})
        }

        ctx.reply = async (message: string, extra: tt.ExtraReplyMessage = undefined): Promise<tt.Message> => {
            this.lastMsg = await this.generateAnswerAfterReply()
            await touchApiMock()
            if (MarkupHelper.isInlineKeyboard(extra?.reply_markup)) {
                this.lastMsg.reply_markup = extra.reply_markup

            }
            this.replies = [...this.replies, {text: message, extra, message: this.lastMsg}]
            return this.lastMsg
        }
        ctx.answerCbQuery = async (text) => {
            if (this.lastCbQuery !== undefined) {
                throw new Error('Double cbQuery answer')
            }
            this.lastCbQuery = text === undefined ? true : text
            await touchApiMock()
            return Promise.resolve(true)
        }
        ctx.editMessageReplyMarkup = async (markup?: tt.InlineKeyboardMarkup): Promise<tt.Message | boolean> => {
            await touchApiMock()
            const lastReply = this.findLastReply()

            if (lastReply === undefined) {
                return false
            } else {
                lastReply.extra.reply_markup = markup
                lastReply.message.reply_markup = markup
            }
            this.lastEdited = lastReply

            return lastReply.message
        }
        ctx.editMessageText = async (text: string, extra?: tt.ExtraEditMessage): Promise<tt.Message | boolean> => {
            await touchApiMock()

            if (ctx.updateType !== 'callback_query') {
                throw new Error(`Telegraf: "editMessageText" isn't available for "message::text"`)
            }

            const lastReply = this.findLastReply()
            if (lastReply === undefined) {
                return false
            } else {
                lastReply.text = text
                lastReply.extra = extra
            }
            this.lastEdited = lastReply

            return lastReply.message
        }

        tg.sendMessage = async (chatId: number | string, text: string, extra?: tt.ExtraEditMessage): Promise<tt.Message> => {
            await ctx.telegram.callApi('mock', {})
            const message: Message = {
                message_id: this.nextMsgId(),
                chat: {
                    id: +chatId,
                    type: 'private'
                },
                date: new Date().getTime(),
                text
            }
            this.replies.push({ message, extra, text })
            return message
        }

        return ctx
    }

    private findLastReply() {
        const lastReply = this.replies.find(reply => reply.message.message_id === this.lastMsg.message_id)
        return lastReply
    }

    async generateAnswerAfterReply(): Promise<Message> {
        return {
            message_id: this.nextMsgId(),
            date: new Date().getTime(),
            chat: CHAT,
        }
    }

    private nextMsgId() {
        return this.lastMsgId++
    }

    blockBotByUser() {
        this.botIsBlocked = true
    }
}

export interface BotReply {
    message: MessageWithInlineMarkup
    text: string
    extra?: tt.ExtraReplyMessage
}
