/// <reference path="./../../../src/types/telegraf.d.ts"/>
import { setWorldConstructor } from '@cucumber/cucumber'
import middlewares, { myRegisterScene } from '../../../src/middleware-utils'
import { ContextMessageUpdate } from '../../../src/interfaces/app-interfaces'
import { customizeScene } from '../../../src/scenes/customize/customize-scene'
import { BotReply, TelegramMockServer } from '../lib/TelegramMockServer'
import { topsScene } from '../../../src/scenes/tops/tops-scene'
import { feedbackScene } from '../../../src/scenes/feedback/feedback-scene'
import { ITestCaseHookParameter } from '@cucumber/cucumber/lib/support_code_library_builder/types'
import { mainScene } from '../../../src/scenes/main/main-scene'
import { packsScene } from '../../../src/scenes/packs/packs-scene'
import { AnalyticsRecorder } from './AnalyticsRecorder'
import { tailScene } from '../../../src/scenes/tail/tail-scene'
import { MarkupHelper } from '../lib/MarkupHelper'
import { searchScene } from '../../../src/scenes/search/search-scene'
import { botErrorHandler } from '../../../src/util/error-handler'
import { likesScene } from '../../../src/scenes/likes/likes-scene'
import { favoritesScene } from '../../../src/scenes/favorites/favorites-scene'
import { adminScene } from '../../../src/scenes/admin/admin-scene'
import { performanceMiddleware } from '../../../src/lib/middleware/performance-middleware'
import { Composer, Middleware, MiddlewareFn, Scenes, session, Telegraf } from 'telegraf'

const noImg = (btnText: string) => btnText.replace(/[^\wа-яА-ЯёЁ ]/g, '').trim()

function isUselessMessage(next: IteratorYieldResult<BotReply> | IteratorReturnResult<any>) {
    return next?.value?.text && next.value.text.indexOf('Дата переопределена') !== -1
}

class CustomWorld {

    private bot = new Telegraf<ContextMessageUpdate>('')
    private now: Date = new Date()
    public readonly server = new TelegramMockServer()
    private middlewaresBeforeScenes: MiddlewareFn<ContextMessageUpdate>[] = []
    private analyticsRecorder = new AnalyticsRecorder()

    constructor() {
        const stage = new Scenes.Stage<ContextMessageUpdate>([], {})

        this.bot.use(
            performanceMiddleware('total'),
            middlewares.i18n,
            middlewares.loggerInject,
            middlewares.telegrafThrottler({
                in: {
                    maxConcurrent: undefined,
                    highWater: undefined,
                },
                out: {
                    maxConcurrent: undefined,
                    highWater: undefined,
                }
            }),
            session(),
            middlewares.sessionTmp,
            // middlewares.logMiddleware('pre_session'),
            middlewares.userMiddleware,
            middlewares.analyticsMiddleware,
            this.analyticsRecorder.middleware(),
            middlewares.dateTime,
            this.executeFeaturesMiddlewares(),
            stage.middleware()
        )

        myRegisterScene(this.bot, stage, [
            mainScene,
            adminScene,
            customizeScene,
            topsScene,
            feedbackScene,
            packsScene,
            searchScene,
            likesScene,
            favoritesScene,
            tailScene
        ])
        this.bot.catch(botErrorHandler)
    }

    async initTestCase(testCase: ITestCaseHookParameter) {
    }

    private executeFeaturesMiddlewares() {
        return async (ctx: ContextMessageUpdate, next: () => Promise<void>) => {
            this.middlewaresBeforeScenes.forEach(it => it.call(this, ctx, () => Promise.resolve()))
            return await next()
        }
    }

    async enterScene(scene: string) {
        await this.server.enterScene(this.bot, scene)
    }

    async sendMessage(text: string) {
        await this.server.sendMessage(this.bot, text)
    }

    async start(payload: string) {
        await this.server.start(this.bot, payload)
    }

    async clickMarkup(buttonText: string) {
        const {message, buttons} = this.server.getListOfMarkupButtonsFromLastMsg()

        const btnTextTransformed = MarkupHelper.replaceI18nBtnsWithoutBraces(buttonText)
        const foundButton = buttons.find(btn => noImg(btn.text) === noImg(btnTextTransformed))
        if (foundButton === undefined) {
            throw new Error(`Cant find '${buttonText}' markup buttons. List of good buttons: ${buttons.map(b => `'${b.text}'`).join(', ')}`)
        }

        await this.server.sendMessage(this.bot, foundButton.text)
    }

    async clickInline(buttonText: string) {
        const {message, buttons} = this.server.getListOfInlineButtonsFromLastMsg()
        let matchButtons = buttons.filter(btn => noImg(btn.text) === noImg(MarkupHelper.replaceI18nBtnsWithoutBraces(buttonText)))
        if (matchButtons.length > 1) {
            matchButtons = buttons.filter(btn => btn.text === buttonText)
        }
        if (matchButtons.length === 0) {
            throw new Error(`Cant find '${buttonText}' inline buttons. List of good buttons: ${buttons.map(b => `'${b.text}'`).join(', ')}`)
        }

        await this.server.clickInline(this.bot, matchButtons[0].callback_data, message)
    }

    async setNow(now: Date) {
        this.now = now
        const setDate = async (ctx: ContextMessageUpdate, next: any) => {
            ctx.session.adminScene = {
                overrideDate: this.now.toISOString()
            }
            return await next()
        }

        await this.server.sendInitialUpdate(this.compose(setDate))
    }

    useBeforeScenes(middleware: MiddlewareFn<ContextMessageUpdate>) {
        this.middlewaresBeforeScenes.push(middleware)
    }

    getLastCbQuery(): string {
        return this.server.getLastCbQuery()
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

    blockBotByUser() {
        this.server.blockBotByUser()
    }

    private compose(middleware: Middleware<ContextMessageUpdate>) {
        return Composer.compose([this.bot.middleware(), middleware])
    }
}

setWorldConstructor(CustomWorld);