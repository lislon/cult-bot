import { ContextMessageUpdate, Event } from '../../interfaces/app-interfaces'
import { MiddlewareFn } from 'telegraf/typings/composer'
import { BaseScene, Composer, Markup } from 'telegraf'
import { limitEventsToPage, SessionEnforcer } from './shared-logic'
import { getLikesRow } from '../likes/likes-common'
import { cardFormat, CardOptions } from './card-format'
import { i18nSceneHelper, sleep } from '../../util/scene-helper'
import { Paging } from './paging'
import { CallbackButton } from 'telegraf/typings/markup'
import { analyticRecordEventView } from '../../lib/middleware/analytics-middleware'

const scene = new BaseScene<ContextMessageUpdate>('');
const {sceneHelper, i18nSharedBtnName, actionName, i18Btn, i18Msg, i18SharedMsg} = i18nSceneHelper(scene)

export type CurrentPage = { limit: number, offset: number }

export interface PagingCommonConfig {
    cardOptions?: CardOptions

    nextPortion(ctx: ContextMessageUpdate, {limit, offset}: CurrentPage): Promise<Event[]>

    getTotal(ctx: ContextMessageUpdate): Promise<number>

    noResults?(ctx: ContextMessageUpdate): Promise<void>

    analytics?(ctx: ContextMessageUpdate, events: Event[], page: CurrentPage): void

    cardButtons?(ctx: ContextMessageUpdate, event: Event): Promise<CallbackButton[][]>

    newQuery?(ctx: ContextMessageUpdate): Promise<void>
}

export interface PagingConfig extends PagingCommonConfig {
    hideNextBtnOnClick?: boolean
    lastEventEndButton?: (ctx: ContextMessageUpdate) => CallbackButton[]
    onLastEvent?: (ctx: ContextMessageUpdate) => Promise<void>
}

export class EventsPager {
    readonly pagingActionName = 'show_more'
    readonly config: PagingConfig

    constructor(config: PagingConfig) {
        this.config = config
    }

    public middleware(): MiddlewareFn<ContextMessageUpdate> {
        return (new Composer<ContextMessageUpdate>()
                .action(/.+/, (ctx: ContextMessageUpdate, next) => {
                    if (ctx.match[0] !== this.pagingActionName) {
                        EventsPager.reset(ctx)
                    }
                    return next()
                })
                .hears(/.+/, (ctx: ContextMessageUpdate, next) => {
                    EventsPager.reset(ctx)
                    return next()
                })
                .action(this.pagingActionName, async (ctx: ContextMessageUpdate, next) => {
                    EventsPager.increment(ctx, limitEventsToPage)

                    await this.showCards(ctx)

                    if (this.config.hideNextBtnOnClick) {
                        await ctx.editMessageReplyMarkup()
                    } else {
                        await ctx.answerCbQuery()
                    }
                })
        ).middleware()
    }

    public async initialShowCards(ctx: ContextMessageUpdate) {
        EventsPager.reset(ctx)
        await this.config.newQuery?.(ctx)
        await this.showCards(ctx)
    }

    private async showCards(ctx: ContextMessageUpdate) {

        const pagingInfo = {
            limit: limitEventsToPage,
            offset: ctx.session.paging.pagingOffset
        }
        const events = await this.config.nextPortion(ctx, pagingInfo)
        this.config.analytics?.(ctx, events, pagingInfo)

        if (ctx.session.paging.total === undefined) {
            ctx.session.paging.total = await this.config.getTotal(ctx)
        }

        let counter = 1;
        for (const event of events) {

            const countLeft = ctx.session.paging.total - pagingInfo.offset - counter
            const isShowMore = countLeft > 0 && counter === limitEventsToPage
            const isLastEvent = countLeft == 0

            counter++

            const buttons = this.config.cardButtons ? await this.config.cardButtons(ctx, event) : [getLikesRow(ctx, event)]

            const showMoreButton = Markup.callbackButton(i18nSharedBtnName('paging_show_more', {countLeft}), this.pagingActionName)
            const likeLine = [
                ...buttons,
                ...[isShowMore ? [showMoreButton] : []],
                ...[isLastEvent && this.config.lastEventEndButton ? this.config.lastEventEndButton(ctx) : []]
            ]

            const html = cardFormat(event, this.config.cardOptions)
            await ctx.replyWithHTML(html, {
                disable_web_page_preview: true,
                reply_markup: Markup.inlineKeyboard(likeLine)
            })

            analyticRecordEventView(ctx, event)

            await sleep(300)

            if (isLastEvent) {
                await this.config.onLastEvent?.(ctx)
            }
        }

        if (events.length === 0) {
            if (ctx.session.paging.pagingOffset > 0) {
                await ctx.replyWithHTML(i18SharedMsg(ctx, 'paging_no_more_events'))
            } else {
                await (this.config.noResults ? this.config.noResults(ctx) : ctx.reply(i18SharedMsg(ctx, 'paging_no_results')))
            }
        }
    }

    public static reset(ctx: ContextMessageUpdate) {
        Paging.prepareSession(ctx)
        ctx.session.paging = {
            pagingOffset: 0
        };
    }

    private prepareSession(ctx: ContextMessageUpdate) {
        ctx.session.paging = {
            pagingOffset: SessionEnforcer.number(ctx.session.paging && ctx.session.paging.pagingOffset),
        }
    }

    private static increment(ctx: ContextMessageUpdate, amount: number) {
        ctx.session.paging.pagingOffset += amount;
    }
}