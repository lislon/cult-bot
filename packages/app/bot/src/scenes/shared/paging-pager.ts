import { ContextMessageUpdate, Event } from '../../interfaces/app-interfaces'
import { Composer, Markup, MiddlewareFn, Scenes } from 'telegraf'
import { SessionEnforcer } from './shared-logic'

import { LimitOffset } from '../../database/db'
import { PagerSliderState, PagingCommonConfig } from './events-common'
import { getLikesRow, LIKES_EVENT_ACTION_PREFIXES } from '../likes/likes-common'
import { cardFormat } from './card-format'
import { analyticRecordEventView } from '../../lib/middleware/analytics-middleware'
import { InlineKeyboardButton } from 'typegram'
import { EventsPagerSliderBase } from './events-slider-base'
import { sleep } from '../../util/scene-utils'
import { i18nSceneHelper } from '../../util/scene-helper'

const scene = new Scenes.BaseScene<ContextMessageUpdate>('')
const {sceneHelper, i18nSharedBtnName, actionName, i18Btn, i18Msg, i18SharedMsg} = i18nSceneHelper(scene)

export type PagingState<Q> = PagerSliderState<Q>

export interface PagingConfig<Q, E = Event> extends PagingCommonConfig<Q, E> {
    limit: number

    analytics?(ctx: ContextMessageUpdate, events: Event[], page: LimitOffset): void

    hideNextBtnOnClick?: boolean

    lastEventEndButton?(ctx: ContextMessageUpdate): InlineKeyboardButton.CallbackButton[]

    onLastEvent?(ctx: ContextMessageUpdate): Promise<void>
}

export class PagingPager<Q, E extends Event = Event> extends EventsPagerSliderBase<Q, PagingConfig<Q, E>, E> {
    readonly showMoreAction = 'show_more'

    public middleware(): MiddlewareFn<ContextMessageUpdate> {
        return (new Composer<ContextMessageUpdate>()
                .action(/.+/, (ctx: ContextMessageUpdate & { match: RegExpExecArray }, next) => {
                    if (ctx.session.paging !== undefined) {
                        const actionName = ctx.match[0]

                        const isLikeEvent = !!LIKES_EVENT_ACTION_PREFIXES.find(s => actionName.startsWith(s))
                        if (actionName !== this.showMoreAction && !isLikeEvent) {
                            this.reset(ctx)
                        }
                    }
                    return next()
                })
                .hears(/.+/, (ctx: ContextMessageUpdate, next) => {
                    if (ctx.session.paging !== undefined) {
                        this.reset(ctx)
                    }
                    return next()
                })
                .action(this.showMoreAction, async (ctx: ContextMessageUpdate, next) => {
                    await ctx.answerCbQuery()
                    if (ctx.session.paging !== undefined) {
                        const pagerState = this.getPagerState(ctx)
                        await this.showCards(ctx, pagerState)
                        if (this.config.hideNextBtnOnClick) {
                            await ctx.editMessageReplyMarkup(Markup.inlineKeyboard([]).reply_markup)
                        }
                    }
                })
        ).middleware()
    }

    async updateState(ctx: ContextMessageUpdate, query: Q, total: number = undefined) {
        const pagerState = this.getPagerState(ctx)
        pagerState.total = total ?? await this.config.getTotal(ctx, query)
        pagerState.savedIdsOffset = 0
        pagerState.savedIds = []
        pagerState.selectedIdx = 0
        pagerState.query = query
    }

    public async initialShowCards(ctx: ContextMessageUpdate) {
        const pagerState = this.getPagerState(ctx)
        await this.showCards(ctx, pagerState)
    }

    reset(ctx: ContextMessageUpdate) {
        ctx.session.paging = undefined
    }

    private async showCards(ctx: ContextMessageUpdate, state: PagerSliderState<Q>): Promise<void> {

        const cardIds = []
        const total = state.total
        const selectedIdx = state.selectedIdx
        for (let i = 0; i < this.config.limit && state.selectedIdx < total; i++) {
            cardIds.push(await this.loadCardId(ctx, state, state.selectedIdx++))
        }

        const events = (await this.config.loadCardsByIds(ctx, cardIds)).filter(e => e !== undefined)


        // this.config.analytics?.(ctx, events, { limit: this.config.limit, offset:  })

        let counter = 1
        for (const event of events) {

            const countLeft = state.total - selectedIdx - counter
            const isShowMore = countLeft > 0 && counter === this.config.limit
            const isLastEvent = countLeft == 0

            counter++


            const showMoreButton = Markup.button.callback(i18nSharedBtnName('paging_show_more', {countLeft}), this.showMoreAction)
            const buttons = [
                ...this.config.cardButtons ? [await this.config.cardButtons(ctx, event)] : [getLikesRow(ctx, event)],
                ...[isShowMore ? [showMoreButton] : []],
                ...[isLastEvent && this.config.lastEventEndButton ? this.config.lastEventEndButton(ctx) : []]
            ]

            const html = cardFormat(event, {now: ctx.now(), ...this.config.cardFormatOptions?.(ctx, event)})
            await ctx.replyWithHTML(html, {
                disable_web_page_preview: true,
                reply_markup: Markup.inlineKeyboard(buttons).reply_markup
            })

            analyticRecordEventView(ctx, event)

            await sleep(300)

            if (isLastEvent) {
                await this.config.onLastEvent?.(ctx)
            }
        }

        if (events.length === 0) {
            if (ctx.session.paging.savedIdsOffset > 0) {
                await ctx.replyWithHTML(i18SharedMsg(ctx, 'paging_no_more_events'))
            } else {
                await (this.config.noResults ? this.config.noResults(ctx) : ctx.reply(i18SharedMsg(ctx, 'paging_no_results')))
            }
        }
    }

    private getPagerState(ctx: ContextMessageUpdate): PagingState<Q> {
        const {
            total,
            savedIdsOffset,
            savedIds,
            selectedIdx,
            query
        } = ctx.session.paging || {}


        ctx.session.paging = {
            total: SessionEnforcer.number(total),
            savedIdsOffset: SessionEnforcer.number(savedIdsOffset, 0),
            savedIds: SessionEnforcer.array(savedIds),
            selectedIdx: SessionEnforcer.number(selectedIdx, 0),
            query
        }

        return ctx.session.paging as PagingState<Q>
    }
}