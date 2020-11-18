import { setWorldConstructor } from '@cucumber/cucumber'
import { Composer, Middleware, Telegraf } from 'telegraf'
import middlewares from '../../../src/middleware-utils'
import { ContextMessageUpdate } from '../../../src/interfaces/app-interfaces'
import { customizeRegisterActions, customizeScene } from '../../../src/scenes/customize/customize-scene'
import { i18n } from '../../../src/util/i18n'
import { BotReply, TelegramMockServer } from '../lib/TelegramMockServer'
import session from 'telegraf/session'

const noImg = (btnText: string) => btnText.replace(/[^\wа-яА-ЯёЁ ]/g, '').trim()


class CustomWorld {

    private bot = new Telegraf<ContextMessageUpdate>('')
    private server = new TelegramMockServer()

    constructor() {
        this.bot.use(
            middlewares.i18n,
            session(),
            // middlewares.logMiddleware('pre_session'),
            middlewares.analyticsMiddleware,
            middlewares.dateTime,
        )
        customizeRegisterActions(this.bot, i18n)
    }

    async enterScene(scene: string) {
        if (scene === 'customize') {
            await this.server.sendInitialUpdate(this.compose(customizeScene.enterMiddleware()))
        } else {
            throw new Error(`Scene ${scene} is not implemented`)
        }
    }

    async clickMarkup(buttonText: string) {
        const { message, buttons } = this.server.getListOfMarkupButtonsFromLastMsg()
        const foundButton = buttons.find(btn => noImg(btn.text) === noImg(buttonText))
        if (foundButton === undefined) {
            throw new Error(`Cant find '${buttonText}' inline buttons. List of good buttons: '${buttons.map(b => `'${b.text}'`).join(', ')}'`)
        }
        await this.server.sendMessage(this.compose(customizeScene.middleware()), foundButton.text)
    }

    async clickInline(buttonText: string) {
        const { message, buttons } = this.server.getListOfInlineButtonsFromLastMsg()
        const callbackData = buttons.find(btn => noImg(btn.text) === noImg(buttonText))?.callback_data
        if (callbackData === undefined) {
            throw new Error(`Cant find '${buttonText}' inline buttons. List of good buttons: '${buttons.map(b => `'${b.text}'`).join(', ')}'`)
        }

        await this.server.clickInline(this.compose(customizeScene.middleware()), callbackData, message)
    }

   async setNow(now: Date) {
        const setDate = async (ctx: ContextMessageUpdate, next: any) => {
            ctx.session.adminScene = {
                overrideDate: now.toISOString()
            }
            return await next()
        }

        await this.server.sendInitialUpdate(this.compose(setDate))
    }

    getNextMsg(): BotReply {
        const next = this.server.replyIterator().next()
        return next.value
    }

    getLastEditedInline(): BotReply {
        return this.server.getLastEditedInline()
    }

    private compose(middleware: Middleware<ContextMessageUpdate>) {
        return Composer.compose([this.bot.middleware(), middleware])
    }
}

setWorldConstructor(CustomWorld);