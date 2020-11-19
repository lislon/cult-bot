import { setWorldConstructor } from '@cucumber/cucumber'
import { Composer, Middleware, Stage, Telegraf } from 'telegraf'
import middlewares, { myRegisterScene } from '../../../src/middleware-utils'
import { ContextMessageUpdate } from '../../../src/interfaces/app-interfaces'
import { customizeScene } from '../../../src/scenes/customize/customize-scene'
import { BotReply, TelegramMockServer } from '../lib/TelegramMockServer'
import session from 'telegraf/session'
import { i18nMiddleware } from '../../../src/lib/middleware/i18n-middleware'
import { packsScene } from '../../../src/scenes/packs/packs-scene'

const noImg = (btnText: string) => btnText.replace(/[^\wа-яА-ЯёЁ ]/g, '').trim()


function isUselessMessage(next: IteratorYieldResult<BotReply> | IteratorReturnResult<any>) {
    return next?.value?.text && next.value.text.indexOf('Дата переопределена') !== -1
}

class CustomWorld {

    private bot = new Telegraf<ContextMessageUpdate>('')
    private now: Date = new Date()
    private server = new TelegramMockServer()

    constructor() {
        const stage = new Stage([], {
        })

        this.bot.use(
            i18nMiddleware,
            session(),
            // middlewares.logMiddleware('pre_session'),
            middlewares.analyticsMiddleware,
            middlewares.dateTime,
            stage.middleware()
        )

        myRegisterScene(this.bot, stage, [ customizeScene, packsScene ])
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
        this.now = now
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
        if (isUselessMessage(next)) {
            return this.getNextMsg()
        }
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