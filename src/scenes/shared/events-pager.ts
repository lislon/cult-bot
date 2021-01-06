import { ContextMessageUpdate, Event } from '../../interfaces/app-interfaces'
import { MiddlewareFn } from 'telegraf/typings/composer'
import { BaseScene, Composer, Markup } from 'telegraf'
import { limitEventsToPage, SessionEnforcer } from './shared-logic'
import { getLikesRow } from '../likes/likes-common'
import { cardFormat } from './card-format'
import { i18nSceneHelper, sleep } from '../../util/scene-helper'
import { Paging } from './paging'

const scene = new BaseScene<ContextMessageUpdate>('');
const {sceneHelper, i18nSharedBtnName, actionName, i18Btn, i18Msg, i18SharedMsg} = i18nSceneHelper(scene)

export type CurrentPage = { limit: number, offset: number }

interface PagingConfig {
    hideNextBtnOnClick?: boolean
    lastEventBackActionName?: string

    nextPortion(ctx: ContextMessageUpdate, {limit, offset}: CurrentPage): Promise<Event[]>

    getTotal(ctx: ContextMessageUpdate): Promise<number>

    noResults(ctx: ContextMessageUpdate): Promise<void>

    analytics?(ctx: ContextMessageUpdate, events: Event[], page: CurrentPage): void
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

    public async showCards(ctx: ContextMessageUpdate) {

        const pagingInfo = {
            limit: limitEventsToPage,
            offset: ctx.session.paging.pagingOffset
        }
        const events = await this.config.nextPortion(ctx, pagingInfo)
        this.config.analytics?.(ctx, events, pagingInfo)

        if (ctx.session.paging.total === undefined) {
            ctx.session.paging.total = await this.config.getTotal(ctx)
        }
        const countLeft = ctx.session.paging.total - pagingInfo.offset
        let counter = 0;
        for (const event of events) {

            const isShowMore = countLeft > 0 && ++counter === limitEventsToPage

            const likeLine = [
                getLikesRow(ctx, event),
                ...[isShowMore ? [Markup.callbackButton(i18nSharedBtnName('paging_show_more', {countLeft}), this.pagingActionName)] : []]
            ]

            await ctx.replyWithHTML(cardFormat(event), {
                disable_web_page_preview: true,
                reply_markup: Markup.inlineKeyboard(likeLine)
            })

            await sleep(300)
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
        ctx.session.paging.pagingOffset = 0;
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