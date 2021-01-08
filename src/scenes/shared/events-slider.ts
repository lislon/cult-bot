import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { PagingConfig } from './events-pager'
import { MiddlewareFn } from 'telegraf/typings/composer'
import { BaseScene, Composer, Markup } from 'telegraf'
import { editMessageAndButtons, SessionEnforcer } from './shared-logic'
import { getLikesRow } from '../likes/likes-common'
import { cardFormat } from './card-format'
import { analyticRecordEventView } from '../../lib/middleware/analytics-middleware'
import { i18nSceneHelper } from '../../util/scene-helper'
import { CallbackButton } from 'telegraf/typings/markup'

const scene = new BaseScene<ContextMessageUpdate>('')
const {sceneHelper, i18nSharedBtnName, actionName, i18Btn, i18Msg, i18SharedMsg} = i18nSceneHelper(scene)

export interface EventsSliderState {
    msgId?: number
    selectedIdx?: number
}

export interface SliderConfig extends PagingConfig {
    backButtons?(ctx: ContextMessageUpdate): Promise<CallbackButton[][]>
}

function prepareSessionStateIfNeeded(ctx: ContextMessageUpdate) {
    const {
        msgId,
        selectedIdx
    } = ctx.session.slider || {}

    ctx.session.slider = {
        msgId: SessionEnforcer.number(msgId),
        selectedIdx: SessionEnforcer.number(selectedIdx, 0),
    }
}


export class EventsSlider {
    readonly config: SliderConfig

    // readonly stateName = ''

    constructor(config: SliderConfig) {
        this.config = config
    }

    //
    // curIndex() {
    //     return this.state.selectedIdx || 0
    // }
    //
    // resetIndex() {
    //     this.state.selectedIdx = undefined
    // }

    public middleware(): MiddlewareFn<ContextMessageUpdate> {
        return (new Composer<ContextMessageUpdate>()
                .action('slider_keyboard.next', async ctx => {
                    if (ctx.session.slider.selectedIdx >= await this.config.getTotal(ctx)) {
                        await ctx.answerCbQuery('Последняя карточка')
                    } else {
                        ctx.session.slider.selectedIdx++
                        await ctx.answerCbQuery()
                    }
                    await this.updateCard(ctx)
                })
                .action('slider_keyboard.prev', async ctx => {
                    await ctx.answerCbQuery()
                    if (ctx.session.slider.selectedIdx <= 0) {
                        await ctx.answerCbQuery('Первая карточка')
                    } else {
                        ctx.session.slider.selectedIdx--
                        await ctx.answerCbQuery()
                    }
                    await this.updateCard(ctx)
                })
            // .action(/.+/, (ctx: ContextMessageUpdate, next) => {
            //     if (ctx.match[0] !== this.pagingActionName) {
            //         EventsPager.reset(ctx)
            //     }
            //     return next()
            // })
            // .hears(/.+/, (ctx: ContextMessageUpdate, next) => {
            //     EventsPager.reset(ctx)
            //     return next()
            // })
            // .action(this.pagingActionName, async (ctx: ContextMessageUpdate, next) => {
            //     EventsPager.increment(ctx, limitEventsToPage)
            //
            //     await this.showCards(ctx)
            //
            //     if (this.config.hideNextBtnOnClick) {
            //         await ctx.editMessageReplyMarkup()
            //     } else {
            //         await ctx.answerCbQuery()
            //     }
            // })
        ).middleware()
    }

    public async initialShowCards(ctx: ContextMessageUpdate) {
        prepareSessionStateIfNeeded(ctx)
        ctx.session.slider.selectedIdx = 0
        await this.config.newQuery?.(ctx)
        await this.updateCard(ctx)
    }

    resetPaging(ctx: ContextMessageUpdate) {

    }

    private getPage(ctx: ContextMessageUpdate) {
        return ctx.session.slider.selectedIdx
    }

    private async updateCard(ctx: ContextMessageUpdate) {

        prepareSessionStateIfNeeded(ctx)

        const pagingInfo = {
            limit: 1,
            offset: ctx.session.slider.selectedIdx
        }
        const events = await this.config.nextPortion(ctx, pagingInfo)
        if (events.length > 1) {
            throw new Error('More then 1 event returned')
        }
        const event = events[0]

        this.config.analytics?.(ctx, events, pagingInfo)

        const cardButtons: CallbackButton[][] = this.config.cardButtons ? await this.config.cardButtons(ctx, event) : [getLikesRow(ctx, event)]
        const backButtons: CallbackButton[][] = this.config.backButtons ? await this.config.backButtons(ctx) : []

        const buttons: CallbackButton[][] = [
            [
                Markup.callbackButton(i18nSharedBtnName('slider_keyboard.prev'), `slider_keyboard.prev`),
                ...cardButtons[0],
                Markup.callbackButton(i18nSharedBtnName('slider_keyboard.next', {
                    position: i18nSharedBtnName('slider_keyboard.position', {
                        page: this.getPage(ctx) + 1,
                        total: await this.config.getTotal(ctx)
                    })
                }), `slider_keyboard.next`),
            ],
            ...backButtons
            // [
            //     Markup.callbackButton(i18Btn(ctx, 'event_back', {
            //         packTitle: packTitleNoEmoji
            //     }), actionName(`event_back`)),
            // ]
        ]

        const html = cardFormat(event, this.config.cardOptions)

        await editMessageAndButtons(ctx, buttons, html)

        analyticRecordEventView(ctx, event)
    }

}