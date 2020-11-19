import {
    ForceReply,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
    ReplyKeyboardRemove
} from 'telegram-typings'
import { BotReply } from './TelegramMockServer'

export type AnyTypeOfKeyboard = InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply

export class MarkupHelper {
    static getKeyboardType(reply: BotReply): 'markup' | 'inline' | undefined {
        if (MarkupHelper.isMarkupKeyboard(reply?.extra?.reply_markup)) {
            return 'markup'
        } else if (MarkupHelper.isInlineKeyboard(reply?.extra?.reply_markup)) {
            return 'inline'
        }
    }

    static trimLeft(str: string) {
        return str.replace(/^\s*/mg, '').trim()
    }


    static toLayout(replyMarkup: AnyTypeOfKeyboard): string {
        if (MarkupHelper.isMarkupKeyboard(replyMarkup)) {
            return MarkupHelper.trimLeft(
                replyMarkup.keyboard.map((line: KeyboardButton[]) => {
                    return line.map((button: KeyboardButton) => `[${button.text}]`).join(' ')
                }).join('\n')
            )

        } else if (MarkupHelper.isInlineKeyboard(replyMarkup)) {
            return MarkupHelper.trimLeft(
                replyMarkup.inline_keyboard.map((line: KeyboardButton[]) => {
                    return line.map((button: KeyboardButton) => `[${button.text}]`).join(' ')
                }).join('\n')
            )
        } else {
            throw Error('Unknown event ' + JSON.stringify(replyMarkup))
        }
    }

    public static listInlineButtons(replyMarkup: AnyTypeOfKeyboard): InlineKeyboardButton[] {
        if (MarkupHelper.isInlineKeyboard(replyMarkup)) {
            return replyMarkup.inline_keyboard.flatMap(line => line)
        }
        return []
    }

    public static listMarkupButtons(replyMarkup: AnyTypeOfKeyboard): KeyboardButton[] {
        if (MarkupHelper.isMarkupKeyboard(replyMarkup)) {
            return replyMarkup.keyboard.flatMap(line => line)
        }
        return []
    }

    public static isMarkupKeyboard(arg: AnyTypeOfKeyboard): arg is ReplyKeyboardMarkup {
        return Array.isArray((arg as any)?.keyboard);
    }

    public static isInlineKeyboard(arg: AnyTypeOfKeyboard): arg is InlineKeyboardMarkup {
        return Array.isArray((arg as any)?.inline_keyboard);
    }
}