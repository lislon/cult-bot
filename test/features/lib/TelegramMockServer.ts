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
    private repliesIndex = 0
    private lastMsg: MessageWithInlineMarkup
    private lastEdited: BotReply

    replyIterator(): Iterator<BotReply> {
        return {
            next: () => {
                return {
                    done: this.repliesIndex >= this.replies.length,
                    value: this.repliesIndex >= this.replies.length ? undefined : this.replies[this.repliesIndex++]
                }
            }
        }
    }

    getLastEditedInline(): BotReply {
        return this.lastEdited
    }

    async sendInitialUpdate(middleware: MiddlewareFn<ContextMessageUpdate>) {
        const update = this.prepareCtxFromServer(makeDefaultEvent({...makeMessage()}))
        await middleware(update, undefined)
    }

    async sendInitialUpdate2(middleware: MiddlewareFn<ContextMessageUpdate>, sceneId: string) {
        const update = this.prepareCtxFromServer(makeDefaultEvent({...makeMessage()}))
        await middleware(update, async () => await update.scene.enter(sceneId))
    }


    async sendMessage(middleware: MiddlewareFn<ContextMessageUpdate>, text: string) {
        const update = this.prepareCtxFromServer(makeDefaultEvent({...makeMessage(text)}))
        await middleware(update, undefined)
    }

    async clickInline(middleware: MiddlewareFn<ContextMessageUpdate>, callbackData: string, message: Message) {
        const update = this.prepareCtxFromServer(makeDefaultEvent({
            callback_query: {
                id: '0',
                ...makeFrom(),
                message: message,
                chat_instance: '0',
                data: callbackData
            }
        }))

        await middleware(update, undefined)
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
            if (MarkupHelper.isInlineKeyboard(extra.reply_markup)) {
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

        return ctx
    }

    async generateAnswerAfterReply(): Promise<Message> {
        return {
            message_id: (this.replies.length === 0 ? 0 : this.replies[this.replies.length - 1].message.message_id) + 1,
            date: new Date().getTime(),
            chat: CHAT,
        }
    }
}

export interface BotReply {
    message: MessageWithInlineMarkup
    text: string
    extra?: tt.ExtraReplyMessage
}