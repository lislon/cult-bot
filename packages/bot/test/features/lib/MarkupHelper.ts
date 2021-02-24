import { BotReply } from './TelegramMockServer'
import { i18n } from '../../../src/util/i18n'
import {
    ForceReply,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
    ReplyKeyboardRemove
} from 'typegram'
import CallbackButton = InlineKeyboardButton.CallbackButton

export type AnyTypeOfKeyboard = InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply

export class MarkupHelper {
    static getKeyboardType(reply: BotReply): 'markup' | 'inline' | undefined {
        if (MarkupHelper.isMarkupKeyboard(reply?.extra?.reply_markup)) {
            return 'markup'
        } else if (MarkupHelper.isInlineKeyboard(reply?.extra?.reply_markup)) {
            return 'inline'
        }
    }

    static prepareExpectedLayout(str: string) {
        const replacedI18N = this.replaceI18nBtns(str)
        return replacedI18N.replace(/^\s*/mg, '').trim()
    }


    static replaceI18nBtnsWithoutBraces(str: string) {
        const s = MarkupHelper.replaceI18nBtns(`[${str}]`)
        return s.substring(1, s.length - 1)
    }

    static replaceI18nBtns(str: string) {
        return str.replace(/\[~([^.]+)\.([^\]]+)\]/g, (match, sceneName, btnName) => {
                const id = `scenes.${sceneName}.keyboard.${btnName}`
                const str = i18n.t('ru', id)
                if (str === undefined) {
                    throw new Error(`Cant resolve btn [${match}] (Tried to find by ${id})`)
                }
                return `[${str}]`;
            }
        )
    }

    static toLayout(replyMarkup: AnyTypeOfKeyboard): string {
        if (MarkupHelper.isMarkupKeyboard(replyMarkup)) {
            return MarkupHelper.prepareExpectedLayout(
                replyMarkup.keyboard.map((line: KeyboardButton.CommonButton[]) => {
                    return line.map((button: KeyboardButton.CommonButton) => `[${button.text}]`).join(' ')
                }).join('\n')
            )

        } else if (MarkupHelper.isInlineKeyboard(replyMarkup)) {
            return MarkupHelper.prepareExpectedLayout(
                replyMarkup.inline_keyboard.map((line: KeyboardButton.CommonButton[]) => {
                    return line.map((button: KeyboardButton.CommonButton) => `[${button.text}]`).join(' ')
                }).join('\n')
            )
        } else {
            throw Error('Unknown event ' + JSON.stringify(replyMarkup))
        }
    }

    public static listInlineButtons(replyMarkup: AnyTypeOfKeyboard): CallbackButton[] {
        if (MarkupHelper.isInlineKeyboard(replyMarkup)) {
            return replyMarkup.inline_keyboard.flatMap(line => line) as CallbackButton[]
        }
        return []
    }

    public static listMarkupButtons(replyMarkup: AnyTypeOfKeyboard): CallbackButton[] {
        if (MarkupHelper.isMarkupKeyboard(replyMarkup)) {
            return replyMarkup.keyboard.flatMap(line => line) as CallbackButton[]
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