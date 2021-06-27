import { Message, Update } from 'typegram'
import { MOCK_CHAT_ID, TEST_USER_TID } from './telegram-mock-common'
import { Chat, User } from 'typegram/manage'

export function makeInlineClick(callbackData: string, message: Message): Pick<Update.CallbackQueryUpdate, 'callback_query'> {
    return {
        callback_query: {
            id: '0',
            ...makeFrom(),
            message: message,
            chat_instance: '0',
            data: callbackData
        }
    }
}

export function makeFrom(): { from: User } {
    return {
        from: {
            id: TEST_USER_TID,
            first_name: 'TestFirstName',
            last_name: 'Ber',
            is_bot: false
        }
    }
}

interface NonChannel {
    chat: Exclude<Chat, Chat.ChannelChat>;
    author_signature?: never;
    from: User;
}

/** Internal type holding properties that updates about new messages share. */
interface New {
    edit_date?: never;
}

export function makeTextMessage(text: string = undefined, override: Partial<Message> = {}): New & NonChannel & Message {

    return {
        date: new Date().getTime(),
        message_id: 0,
        chat: {
            id: MOCK_CHAT_ID,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            type: 'private',
            first_name: ''
        },
        text: text,
        from: makeFrom().from,
        ...override,
    }
}

export function makeMessageUpdate(text: string = undefined, override: Partial<Message> = {}): Update.MessageUpdate {
    return {
        update_id: 0,
        message: makeTextMessage(text, override)
    }
}

export function makeCommand(command: string, payload = ''): Pick<Update.MessageUpdate, 'message'> {
    return {
        ...makeMessageUpdate([command, payload].join(' '), {
            entities: [{
                offset: 0,
                type: 'bot_command',
                length: command.length
            }]
        })
    }
}

export function makeDefaultUpdateEvent(content: Pick<Update.MessageUpdate, 'message'> | Pick<Update.CallbackQueryUpdate, 'callback_query'>): Update.MessageUpdate | Update.CallbackQueryUpdate {
    return {
        ...content,
        update_id: 0,
    }
}