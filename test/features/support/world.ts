import { setWorldConstructor } from '@cucumber/cucumber'
import { Composer, Middleware, Stage, Telegraf } from 'telegraf'
import middlewares, { myRegisterScene } from '../../../src/middleware-utils'
import { ContextMessageUpdate } from '../../../src/interfaces/app-interfaces'
import { customizeScene } from '../../../src/scenes/customize/customize-scene'
import { BotReply, TelegramMockServer } from '../lib/TelegramMockServer'
import session from 'telegraf/session'
import { topsScene } from '../../../src/scenes/tops/tops-scene'
import { MiddlewareFn } from 'telegraf/typings/composer'
import { feedbackScene } from '../../../src/scenes/feedback/feedback-scene'
import { ITestCaseHookParameter } from '@cucumber/cucumber/lib/support_code_library_builder/types'
import { mainScene } from '../../../src/scenes/main/main-scene'

const noImg = (btnText: string) => btnText.replace(/[^\wа-яА-ЯёЁ ]/g, '').trim()


function isUselessMessage(next: IteratorYieldResult<BotReply> | IteratorReturnResult<any>) {
    return next?.value?.text && next.value.text.indexOf('Дата переопределена') !== -1
}

class CustomWorld {

    private bot = new Telegraf<ContextMessageUpdate>('')
    private now: Date = new Date()
    private server = new TelegramMockServer()
    private middlewaresBeforeScenes: MiddlewareFn<ContextMessageUpdate>[] = []

    constructor() {
        const stage = new Stage([], {
        })

        this.bot.use(
            middlewares.i18n,
            session(),
            // middlewares.logMiddleware('pre_session'),
            middlewares.userSaveMiddleware,
            middlewares.analyticsMiddleware,
            middlewares.dateTime,
            this.executeFeaturesMiddlewares(),
            stage.middleware()
        )

        myRegisterScene(this.bot, stage, [ mainScene, customizeScene, topsScene, feedbackScene ])
    }

    async initTestCase(testCase: ITestCaseHookParameter) {
    }

    private executeFeaturesMiddlewares() {
        return async (ctx: ContextMessageUpdate, next: () => Promise<void>) => {
            this.middlewaresBeforeScenes.forEach(it => it.call(this, ctx))
            return await next()
        }
    }

    async enterScene(scene: string) {
        await this.server.enterScene(this.bot.middleware(), scene)
    }

    async sendMessage(text: string) {
        await this.server.sendMessage(this.bot.middleware(), text)
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

    useBeforeScenes(middleware: MiddlewareFn<ContextMessageUpdate>) {
        this.middlewaresBeforeScenes.push(middleware)
    }

    getNextMsg(): BotReply {
        const next = this.server.replyIterator().next()
        if (isUselessMessage(next)) {
            return this.getNextMsg()
        }
        return next.value
    }

    getNextMsgOtherChat(): BotReply {
        const next = this.server.replyIteratorOtherChat().next()
        return next.value
    }

    getLastEditedInline(): BotReply {
        return this.server.getLastEditedInline()
    }

    ctx(): ContextMessageUpdate {
        return this.server.ctx()
    }

    private compose(middleware: Middleware<ContextMessageUpdate>) {
        return Composer.compose([this.bot.middleware(), middleware])
    }
}

setWorldConstructor(CustomWorld);