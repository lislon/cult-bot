import { Context, MiddlewareFn, Telegraf, Telegram, TelegramError } from 'telegraf'
import {
    ExtraEditMessageText,
    ExtraReplyMessage,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    Message,
    Update
} from 'telegraf/typings/telegram-types'
import { ContextMessageUpdate } from '../../../src/interfaces/app-interfaces'
import { MarkupHelper } from './MarkupHelper'
import { Chat, User } from 'typegram/manage'
import { omit } from 'lodash'
import ServiceMessage = Message.ServiceMessage
import TextMessage = Message.TextMessage
import CallbackButton = InlineKeyboardButton.CallbackButton
import CommonButton = KeyboardButton.CommonButton

const CHAT_ID = 1234
const FROM_ID = 7777

type MessageWithInlineMarkup = Message.CommonMessage

const CHAT: Chat.PrivateChat = {
    id: CHAT_ID,
    type: 'private',
    first_name: ''
}

function makeFrom(): { from: User } {
    return {
        from: {
            id: FROM_ID,
            first_name: 'TestFirstName',
            last_name: 'Ber',
            is_bot: false
        }
    }
}

function makeMessage(text: string = undefined, override: Partial<Message> = {}): Update.MessageUpdate {
    const message: ServiceMessage = {
        date: new Date().getTime(),
        message_id: 0,
        chat: CHAT,
        ...override
    }

    return {
        update_id: 0,
        message: {...message, text: text, from: makeFrom().from, chat: CHAT}
    }
}

function makeCommand(command: string, payload: string = ''): Pick<Update.MessageUpdate, 'message'> {
    return {
        ...makeMessage([command, payload].join(' '), {
            entities: [{
                offset: 0,
                type: 'bot_command',
                length: command.length
            }]
        })
    }
}

const makeDefaultEvent = (content: Pick<Update.MessageUpdate, 'message'> | Pick<Update.CallbackQueryUpdate, 'callback_query'>): Update.MessageUpdate | Update.CallbackQueryUpdate => {
    return {
        ...content,
        update_id: 0,
    }
}

export class TelegramMockServer {
    // private currentScene = ''
    private replies: BotReply[] = []
    private repliesIterIndex = { index: 0 }
    private repliesIterIndexOtherChat = {index: 0}
    private lastMsg: Message.TextMessage
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
        this.lastCtx = this.prepareCtxFromServer(makeDefaultEvent(makeMessage()))
        await middleware(this.lastCtx, () => Promise.resolve())
    }

    async enterScene(bot: Telegraf<ContextMessageUpdate>, sceneId: string) {
        this.lastCtx = this.prepareCtxFromServer(makeDefaultEvent(makeMessage()))
        try {
            await bot.middleware()(this.lastCtx, async () => {
                await this.lastCtx.scene.enter(sceneId)
            })
        } catch (e) {
            await (bot as any).handleError(e, this.lastCtx)
        }
    }


    async sendMessage(bot: Telegraf<ContextMessageUpdate>, text: string) {
        if (text.startsWith('/')) {
            this.lastCtx = this.prepareCtxFromServer(makeDefaultEvent(makeCommand(text)))
        } else {
            this.lastCtx = this.prepareCtxFromServer(makeDefaultEvent({...makeMessage(text)}))
        }
        try {
            await bot.middleware()(this.lastCtx, () => Promise.resolve())
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
            throw new Error('Bad behaviour! Missing cbQuery call after action')
        }
    }

    async start(bot: Telegraf<ContextMessageUpdate>, payload: string) {
        this.lastCtx = this.prepareCtxFromServer(makeDefaultEvent(makeCommand('/start', payload)))
        await bot.middleware()(this.lastCtx, undefined)
    }

    getListOfInlineButtonsFromLastMsg(): { message: TextMessage, buttons: CallbackButton[] } {
        for (let i = this.replies.length - 1; i >= 0; i--) {
            if (MarkupHelper.isInlineKeyboard(this.replies[i].extra?.reply_markup)) {
                return {
                    message: this.replies[i].message,
                    buttons: MarkupHelper.listInlineButtons(this.replies[i].extra.reply_markup)
                }
            }
        }
        return {message: undefined, buttons: []}
    }

    getListOfMarkupButtonsFromLastMsg(): { message: MessageWithInlineMarkup, buttons: CommonButton[] } {
        for (let i = this.replies.length - 1; i >= 0; i--) {
            if (MarkupHelper.isMarkupKeyboard(this.replies[i].extra?.reply_markup)) {
                return {
                    message: this.replies[i].message,
                    buttons: MarkupHelper.listMarkupButtons(this.replies[i].extra.reply_markup)
                }
            }
        }
        return {message: undefined, buttons: []}
    }

    private prepareCtxFromServer(update: Update): ContextMessageUpdate {
        const tg = new Telegram('', {})

        tg.callApi = async (method: any, payload: any, callApiOptions: any): Promise<any> => {
            if (this.botIsBlocked) {
                throw new TelegramError({
                    error_code: 403,
                    description: 'bot was blocked by the user'
                })
            }
        }

        const ctx: ContextMessageUpdate = new Context(update, tg, {
            id: 0,
            first_name: 'bot',
            can_join_groups: false,
            can_read_all_group_messages: false,
            supports_inline_queries: false,
            username: 'bot',
            is_bot: true
        }) as ContextMessageUpdate

        async function touchApiMock() {
            await ctx.telegram.callApi('getMe', {chat_id: 0})
        }

        ctx.reply = async (message: string, extra: ExtraReplyMessage = undefined): Promise<Message.TextMessage> => {
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
        ctx.editMessageReplyMarkup = async (markup?: InlineKeyboardMarkup): Promise<(Update.Edited & Message) | true> => {
            await touchApiMock()
            const lastReply = this.findLastReply()

            if (lastReply === undefined) {
                throw new Error('was false')
            } else {
                lastReply.extra.reply_markup = markup
                lastReply.message.reply_markup = markup
            }
            this.lastEdited = lastReply

            const result: Update.Edited & Message = {
                ...omit(lastReply.message, [
                    'forward_from',
                    'forward_from_chat',
                    'forward_from_message_id',
                    'forward_signature',
                    'forward_sender_name',
                    'forward_date'
                ]),
                edit_date: 0,
            }

            return result
        }

        ctx.editMessageText = async (text: string, extra?: ExtraEditMessageText): Promise<(Update.Edited & Message.TextMessage) | true> => {
            await touchApiMock()

            if (ctx.updateType !== 'callback_query') {
                throw new Error(`Telegraf: "editMessageText" isn't available for "message::text"`)
            }

            const lastReply = this.findLastReply()
            if (lastReply === undefined) {
                return true
            } else {
                lastReply.text = text
                lastReply.extra = extra
            }
            this.lastEdited = lastReply

            return {...(lastReply.message), edit_date: 0} as Update.Edited & Message.TextMessage
        }

        tg.sendMessage = async (chatId: number | string, text: string, extra?: ExtraEditMessageText): Promise<Message.TextMessage> => {
            await touchApiMock()
            const message: TextMessage = {
                message_id: this.nextMsgId(),
                chat: {
                    id: +chatId,
                    first_name: '',
                    type: 'private'
                },
                date: new Date().getTime(),
                text
            }
            this.replies.push({message, extra, text})
            return message
        }

        return ctx
    }

    private findLastReply(): BotReply {
        return this.replies.find(reply => reply.message.message_id === this.lastMsg.message_id)
    }

    async generateAnswerAfterReply(): Promise<Message.TextMessage> {
        return {
            message_id: this.nextMsgId(),
            text: '',
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
    message: Message.TextMessage
    text: string
    extra?: ExtraReplyMessage
}
