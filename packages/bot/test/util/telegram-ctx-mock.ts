import { Context, Scenes, Telegram, TelegramError } from 'telegraf'
import { ContextMessageUpdate, MySession, MySessionTmp } from '../../src/interfaces/app-interfaces'
import { instance, mock } from 'ts-mockito'
import { Logger } from 'winston'
import I18n from 'telegraf-i18n'
import { Visitor } from 'universal-analytics'
import { InlineKeyboardMarkup, Message, Update, UserFromGetMe } from 'typegram'
import { EditMessageReplyType, MOCK_BOT_INFO, MOCK_CHAT } from './telegram-mock-common'
import { ExtraEditMessageText, ExtraReplyMessage } from 'telegraf/typings/telegram-types'
import { MarkupHelper } from '../features/lib/MarkupHelper'
import { isEqual, omit } from 'lodash'
import { BotReply } from './telegram-server-mock'
import TextMessage = Message.TextMessage
import { PerformanceContext } from '../../src/lib/middleware/performance-middleware'
import {
    makeCommand,
    makeDefaultUpdateEvent,
    makeInlineClick,
    makeMessageUpdate,
    makeTextMessage
} from './telegram-mock-update'

/**
 * Этот класс несет в себе одно сообщение от сервера телеграмма, в отличие от CtxServer, который хранит всю историю.
 */
export class TelegramCtxMock extends Context implements ContextMessageUpdate {
    logger = instance(mock<Logger>())
    i18n = instance(mock(I18n))
    ua = instance(mock(Visitor))
    perf: PerformanceContext = undefined
    scene: Scenes.SceneContextScene<ContextMessageUpdate> = undefined
    session: MySession = undefined
    sessionTmp: MySessionTmp = undefined
    public botIsBlocked: boolean = false
    private lastMsgId = 0

    private replies: BotReply[] = []
    private lastMsg: Message
    private lastEdited: BotReply
    private lastCbQuery: string | true = undefined
    private wasNotModifiedError: boolean = false

    public isNotModifiedError(): boolean {
        return this.wasNotModifiedError
    }

    public static createFromInlineClick(callbackData: string, message: Message = makeTextMessage()): TelegramCtxMock {
        return TelegramCtxMock.create(makeDefaultUpdateEvent(makeInlineClick(callbackData, message)))
    }

    public static createFromInitialUpdate(): TelegramCtxMock {
        return TelegramCtxMock.create(makeDefaultUpdateEvent(makeMessageUpdate()))
    }

    public static createTextReply(text: string, startPayload: string = undefined): TelegramCtxMock {
        if (text.startsWith('/')) {
            return TelegramCtxMock.create(makeDefaultUpdateEvent(makeCommand(text, startPayload)))
        }
        return TelegramCtxMock.create(makeDefaultUpdateEvent(makeMessageUpdate(text)))
    }

    public static create(update: Update): TelegramCtxMock {
        const tg = new Telegram('', {})

        // async function touchApiMock() {
        //     await ctx.telegram.callApi('getMe', {chat_id: 0})
        // }

        return new TelegramCtxMock(update, tg, MOCK_BOT_INFO)
    }

    constructor(update: Update, tg: Telegram, botInfo: UserFromGetMe) {
        super(update, tg, botInfo)

        tg.callApi = async (method: any, payload: any, callApiOptions: any): Promise<any> => {
            if (this.botIsBlocked) {
                throw new TelegramError({
                    error_code: 403,
                    description: 'bot was blocked by the user'
                })
            }
        }

        tg.sendMessage = async (chatId: number | string, text: string, extra?: ExtraEditMessageText): Promise<Message.TextMessage> => {
            // await touchApiMock()
            const message: TextMessage = {
                message_id: this.nextMsgIdGetAndIncrement(),
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
    }

    public continueSessionFrom(old: TelegramCtxMock): TelegramCtxMock {
        this.session = old.session
        return this
    }

    public continueServerStateFrom(old: TelegramCtxMock | undefined): TelegramCtxMock {
        if (old !== undefined) {
            this.replies = old.replies
            this.lastMsg = old.lastMsg
            this.lastMsgId = old.lastMsgId
            this.lastEdited = old.lastEdited
            this.botIsBlocked = old.botIsBlocked
        }
        return this
    }


    public async reply(message: string, extra: ExtraReplyMessage = undefined): Promise<Message.TextMessage> {
        this.lastMsg = this.replyReturnValue()
        // await touchApiMock()
        if (MarkupHelper.isInlineKeyboard(extra?.reply_markup)) {
            this.lastMsg.reply_markup = extra.reply_markup
        }
        this.replies = [...this.replies, {text: message, extra, message: this.lastMsg}]
        return this.lastMsg
    }

    public async answerCbQuery(text: string): Promise<true> {
        if (this.lastCbQuery !== undefined) {
            throw new Error('Double cbQuery answer')
        }
        this.lastCbQuery = text === undefined ? true : text
        // await touchApiMock()
        return true
    }

    public async editMessageReplyMarkup(markup: (InlineKeyboardMarkup | undefined)): Promise<EditMessageReplyType> {
        // await touchApiMock()
        const lastReply = this.findLastReply()

        if (lastReply === undefined) {
            throw new Error('was false')
        } else {
            lastReply.extra.reply_markup = markup
            lastReply.message.reply_markup = markup
        }
        this.lastEdited = lastReply

        return {
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
    }

    public async editMessageText(text: string, extra?: ExtraEditMessageText): Promise<(Update.Edited & Message.TextMessage) | true> {
        // await touchApiMock()

        if (this.updateType !== 'callback_query') {
            throw new Error(`Telegraf: "editMessageText" isn't available for "message::text"`)
        }

        const lastReply = this.findLastReply()
        if (lastReply === undefined) {
            return true
        } else if (isEqual([lastReply.text, lastReply.extra], [text, extra])) {
            this.wasNotModifiedError = true
            throw new TelegramError({
                error_code: 400,
                description: 'Bad Request: message is not modified: specified new message content and reply markup are exactly the same as a current content and reply markup of the message'
            })
        } else {
            lastReply.text = text
            lastReply.extra = extra
        }
        this.lastEdited = lastReply

        return {...(lastReply.message), edit_date: 0} as Update.Edited & Message.TextMessage
    }

    private nextMsgIdGetAndIncrement() {
        return this.lastMsgId++
    }

    private replyReturnValue(): Message.TextMessage {
        return {
            message_id: this.nextMsgIdGetAndIncrement(),
            text: '',
            date: new Date().getTime(),
            chat: MOCK_CHAT,
        }
    }

    public findLastReply(): BotReply {
        return this.replies.find(reply => reply.message.message_id === this.lastMsg.message_id)
    }

    public getReplies(): BotReply[] {
        return this.replies
    }

    public getLastCbReply(): string | true {
        return this.lastCbQuery
    }

    public getLastEdited(): BotReply {
        return this.lastEdited
    }

    public resetCbQuery(): void {
    }


    isNowOverridden(): boolean {
        return false
    }

    public now(): Date {
        return new Date(2010, 1, 1)
    }

}