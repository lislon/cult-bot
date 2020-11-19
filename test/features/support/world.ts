import { setWorldConstructor } from '@cucumber/cucumber'
import { Composer, Middleware, Stage, Telegraf } from 'telegraf'
import middlewares, { myRegisterScene } from '../../../src/middleware-utils'
import { ContextMessageUpdate } from '../../../src/interfaces/app-interfaces'
import { customizeScene } from '../../../src/scenes/customize/customize-scene'
import { BotReply, TelegramMockServer } from '../lib/TelegramMockServer'
import session from 'telegraf/session'
import { i18nMiddleware } from '../../../src/lib/middleware/i18n-middleware'

const noImg = (btnText: string) => btnText.replace(/[^\wа-яА-ЯёЁ ]/g, '').trim()


class CustomWorld {

    private bot = new Telegraf<ContextMessageUpdate>('')

    private server = new TelegramMockServer()

    constructor() {
        const stage = new Stage([], {
            default: 'customize'
        })

        this.bot.use(
            i18nMiddleware,
            session(),
            // middlewares.logMiddleware('pre_session'),
            middlewares.analyticsMiddleware,
            middlewares.dateTime,
            stage.middleware()
        )

        myRegisterScene(this.bot, stage, [ customizeScene ])
        //
        //
        // const X = (name: string) => async (ctx: any, next: any) => {
        //     console.log('before ' + name)
        //     await next()
        //     console.log('after ' + name)
        // }
        //
        // this.bot.use(X('A'))
        // const subBot = i18nWrapSceneContext(this.bot, 'X1')
        // subBot.use(X('B'))
        // this.bot.use(X('C'))
        //
        //
    }

    async enterScene(scene: string) {
        await this.server.sendInitialUpdate2(this.bot.middleware(), scene)
    }

    async clickMarkup(buttonText: string) {
        const { message, buttons } = this.server.getListOfMarkupButtonsFromLastMsg()
        const foundButton = buttons.find(btn => noImg(btn.text) === noImg(buttonText))
        if (foundButton === undefined) {
            throw new Error(`Cant find '${buttonText}' inline buttons. List of good buttons: '${buttons.map(b => `'${b.text}'`).join(', ')}'`)
        }

        await this.server.sendMessage(this.bot.middleware(), foundButton.text)
    }

    async clickInline(buttonText: string) {
        const { message, buttons } = this.server.getListOfInlineButtonsFromLastMsg()
        const callbackData = buttons.find(btn => noImg(btn.text) === noImg(buttonText))?.callback_data
        if (callbackData === undefined) {
            throw new Error(`Cant find '${buttonText}' inline buttons. List of good buttons: '${buttons.map(b => `'${b.text}'`).join(', ')}'`)
        }

        await this.server.clickInline(this.bot.middleware(), callbackData, message)
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