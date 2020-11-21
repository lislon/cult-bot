import { Context, Telegram } from 'telegraf'
import * as tt from 'telegraf/typings/telegram-types'
import { ContextMessageUpdate } from '../../../src/interfaces/app-interfaces'
import { InlineKeyboardButton, InlineKeyboardMarkup, KeyboardButton, Message } from 'telegram-typings'
import { MiddlewareFn } from 'telegraf/typings/composer'
import { MarkupHelper } from './MarkupHelper'

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
            first_name: 'Cucu',
            last_name: 'Ber',
            is_bot: false
        }
    }
}

function makeMessage(text: string = undefined) {
    return {
        message: {
            ...makeFrom(),
            date: new Date().getTime(),
            message_id: 0,
            text: text,
            chat: CHAT,
        }
    }
}

const makeDefaultEvent = (content: any) => {
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

    getLastEditedInline(): BotReply {
        return this.lastEdited
    }

    async sendInitialUpdate(middleware: MiddlewareFn<ContextMessageUpdate>) {
        this.lastCtx = this.prepareCtxFromServer(makeDefaultEvent({...makeMessage()}))
        await middleware(this.lastCtx, undefined)
    }

    async enterScene(middleware: MiddlewareFn<ContextMessageUpdate>, sceneId: string) {
        this.lastCtx = this.prepareCtxFromServer(makeDefaultEvent({...makeMessage()}))
        await middleware(this.lastCtx, async () => await this.lastCtx.scene.enter(sceneId))
    }


    async sendMessage(middleware: MiddlewareFn<ContextMessageUpdate>, text: string) {
        this.lastCtx = this.prepareCtxFromServer(makeDefaultEvent({...makeMessage(text)}))
        await middleware(this.lastCtx, undefined)
    }

    async clickInline(middleware: MiddlewareFn<ContextMessageUpdate>, callbackData: string, message: Message) {
        this.lastCtx = this.prepareCtxFromServer(makeDefaultEvent({
            callback_query: {
                id: '0',
                ...makeFrom(),
                message: message,
                chat_instance: '0',
                data: callbackData
            }
        }))

        await middleware(this.lastCtx, undefined)
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
        tg.callApi = (method: any, data: any): any => {
            // console.log(`mocked tg callApi ${method}`, data)
        }

        const ctx: ContextMessageUpdate = new Context(update, tg, {}) as ContextMessageUpdate

        ctx.reply = async (message: string, extra: tt.ExtraReplyMessage = undefined): Promise<tt.Message> => {
            this.lastMsg = await this.generateAnswerAfterReply()
            if (MarkupHelper.isInlineKeyboard(extra?.reply_markup)) {
                this.lastMsg.reply_markup = extra.reply_markup
            }

            this.replies = [...this.replies, { text: message, extra, message: this.lastMsg }]
            return this.lastMsg
        }
        ctx.editMessageReplyMarkup = async (markup?: tt.InlineKeyboardMarkup): Promise<tt.Message | boolean> => {
            const lastReply = this.replies.find(reply => reply.message.message_id === this.lastMsg.message_id)

            if (lastReply === undefined) {
                return false
            } else {
                lastReply.extra.reply_markup = markup
                lastReply.message.reply_markup = markup
            }
            this.lastEdited = lastReply

            return lastReply.message
        }
        tg.sendMessage = async (chatId: number | string, text: string, extra?: tt.ExtraEditMessage): Promise<tt.Message> => {
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
}

export interface BotReply {
    message: MessageWithInlineMarkup
    text: string
    extra?: tt.ExtraReplyMessage
}