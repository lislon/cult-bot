import { setWorldConstructor } from '@cucumber/cucumber'
import middlewares, { myRegisterScene } from '../../../src/middleware-utils'
import { ContextMessageUpdate } from '../../../src/interfaces/app-interfaces'
import { customizeScene } from '../../../src/scenes/customize/customize-scene'
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
import { cardZooScene } from '../../../src/scenes/card-zoo/card-zoo-scene'
import { BotReply, TelegramServerMock } from '../../util/telegram-server-mock'
import { KeyboardButton } from 'typegram'
import CommonButton = KeyboardButton.CommonButton

const noImg = (btnText: string) => btnText.replace(/[^\wа-яА-ЯёЁ ]/g, '').trim()

function isUselessMessage(next: IteratorYieldResult<BotReply> | IteratorReturnResult<any>) {
    return next?.value?.text && next.value.text.indexOf('Дата переопределена') !== -1
}

class CustomWorld {

    private bot = new Telegraf<ContextMessageUpdate>('')
    private now: Date = new Date()
    public readonly server = new TelegramServerMock()
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
            middlewares.sessionTmp(),
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
            cardZooScene,
            tailScene
        ])
        this.bot.catch(botErrorHandler)
    }

    async worldInitTestCase(testCase: ITestCaseHookParameter) {
    }

    private executeFeaturesMiddlewares() {
        return async (ctx: ContextMessageUpdate, next: () => Promise<void>) => {
            this.middlewaresBeforeScenes.forEach(it => it.call(this, ctx, () => Promise.resolve()))
            return await next()
        }
    }

    async worldEnterScene(scene: string) {
        await this.server.enterScene(this.bot, scene)
    }

    async worldSendMessage(text: string) {
        await this.server.sendMessage(this.bot, text)
    }

    async worldStart(payload: string) {
        await this.server.start(this.bot, payload)
    }

    async worldClickMarkup(buttonText: string) {
        const {message, buttons} = this.server.getListOfMarkupButtonsFromLastMsg()

        const btnTextTransformed = MarkupHelper.replaceI18nBtnsWithoutBraces(buttonText)
        const foundButton = buttons.find(btn => noImg(btn.text) === noImg(btnTextTransformed))
        if (foundButton === undefined) {
            throw new Error(`Cant find '${buttonText}' markup buttons. List of good buttons: ${CustomWorld.makeListOfButtons(buttons)}`)
        }

        await this.server.sendMessage(this.bot, foundButton.text)
    }

    async worldClickInline(buttonText: string) {
        const {message, buttons} = this.server.getListOfInlineButtonsFromLastMsg()
        let matchButtons = buttons.filter(btn => noImg(btn.text) === noImg(MarkupHelper.replaceI18nBtnsWithoutBraces(buttonText)))
        if (matchButtons.length > 1) {
            matchButtons = buttons.filter(btn => btn.text === buttonText)
        }
        if (matchButtons.length === 0) {
            throw new Error(`Cant find '${buttonText}' inline buttons. List of good buttons: ${CustomWorld.makeListOfButtons(buttons)}`)
        }

        await this.server.clickInline(this.bot, matchButtons[0].callback_data, message)
    }

    async worldSetNow(now: Date) {
        this.now = now
        const setDate = async (ctx: ContextMessageUpdate, next: any) => {
            ctx.session.adminScene = {
                overrideDate: this.now.toISOString(),
            }
            return await next()
        }

        await this.server.sendInitialUpdate(this.compose(setDate))
    }

    worldUseBeforeScenes(middleware: MiddlewareFn<ContextMessageUpdate>) {
        this.middlewaresBeforeScenes.push(middleware)
    }

    worldGetLastCbQuery(): string | true {
        return this.server.getLastCbQuery()
    }

    worldGetNextMsg(): BotReply {
        const next = this.server.replyIterator().next()
        if (isUselessMessage(next)) {
            return this.worldGetNextMsg()
        }
        return next.value
    }

    worldGetNextMsgOtherChat(): BotReply {
        const next = this.server.replyIteratorOtherChat().next()
        return next.value
    }

    worldGetLastEditedInline(): BotReply {
        return this.server.getLastEditedInline()
    }

    worldCtx(): ContextMessageUpdate {
        return this.server.ctx()
    }

    worldBlockBotByUser() {
        this.server.blockBotByUser()
    }

    private compose(middleware: Middleware<ContextMessageUpdate>) {
        return Composer.compose([this.bot.middleware(), middleware])
    }

    private static makeListOfButtons(buttons: CommonButton[]): string {
        return buttons.length > 0 ? buttons.map(b => `'${b.text}'`).join(', ') : '<none>'
    }
}

setWorldConstructor(CustomWorld);