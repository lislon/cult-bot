import { ContextMessageUpdate, Event } from '../../interfaces/app-interfaces'
import { MiddlewareFn } from 'telegraf/typings/composer'
import { BaseScene, Composer, Markup } from 'telegraf'
import { editMessageAndButtons, EditMessageAndButtonsOptions, getMsgId } from './shared-logic'
import { getLikesRow } from '../likes/likes-common'
import { cardFormat } from './card-format'
import { analyticRecordEventView } from '../../lib/middleware/analytics-middleware'
import { i18nSceneHelper } from '../../util/scene-helper'
import { CallbackButton } from 'telegraf/typings/markup'
import { EventsPagerSliderBase, PagerSliderState, PagingCommonConfig } from './events-common'
import { botConfig } from '../../util/bot-config'
import { InlineKeyboardMarkup } from 'telegram-typings'

const scene = new BaseScene<ContextMessageUpdate>('')
const {sceneHelper, i18nSharedBtnName, actionName, i18Btn, i18Msg, i18SharedMsg} = i18nSceneHelper(scene)

export interface SliderState<Q> extends PagerSliderState<Q> {
    msgId: number
    sceneId: string
    ttl: number
}

export interface AllSlidersState {
    sliders: SliderState<unknown>[]
}

export interface TotalOffset {
    total: number
    offset: number
}

export interface SliderConfig<Q, E extends Event = Event> extends PagingCommonConfig<Q, E> {
    noCardsText?(ctx: ContextMessageUpdate): string

    backButton(ctx: ContextMessageUpdate): CallbackButton

    analytics?(ctx: ContextMessageUpdate, event: Event, {total, offset}: TotalOffset, state: Q): void
}

function getSliderState(ctx: ContextMessageUpdate): AllSlidersState {
    if (ctx.session.slider === undefined) {
        ctx.session.slider = {
            sliders: []
        }
    }
    if (ctx.session.slider.sliders === undefined) {
        ctx.session.slider.sliders = []
    }
    delete (ctx.session.slider as any).selectedIdx
    return ctx.session.slider
}

function getBtnPosition(page: number, total: number) {
    return i18nSharedBtnName('slider_keyboard.next', {
        position: i18nSharedBtnName('slider_keyboard.position', {
            page: page,
            total: total
        })
    })
}

export interface UpdateData<Q> {
    state?: Q
    total?: number
    msgId?: number
    invalidateOtherSliders?: boolean
}

export class SliderPager<Q, E extends Event = Event> extends EventsPagerSliderBase<Q, SliderConfig<Q, E>, E> {

    async updateState(ctx: ContextMessageUpdate, updateData: UpdateData<Q>): Promise<SliderState<Q>> {
        const fixedMsgIdOrExistingCardId = updateData.msgId ?? this.getSliderStateIfExists(ctx)?.msgId
        const sliderState = this.saveOrReplaceSliderState(ctx, updateData.state, fixedMsgIdOrExistingCardId)
        sliderState.total = updateData.total ?? await this.config.getTotal(ctx, sliderState.query)
        if (updateData.invalidateOtherSliders) {
            this.invalidateOtherSceneSliders(ctx, sliderState)
        }
        return sliderState
    }

    tryRestoreStateFromMsg(ctx: ContextMessageUpdate): Q | undefined {
        return this.getSliderStateIfExists(ctx)?.query
    }

    private invalidateOtherSceneSliders(ctx: ContextMessageUpdate, latestState: SliderState<Q>) {
        const state = getSliderState(ctx)
        ctx.logger.silly(`msgId: ${getMsgId(ctx)}`)
        ctx.logger.silly(`invalidateSliders old: ${state.sliders.filter(s => s.sceneId === this.config.sceneId).map(s => s.msgId || 'undefined').join(',')}`)
        state.sliders = state.sliders.filter(s => s.sceneId !== this.config.sceneId || s === latestState)
        ctx.logger.silly(`invalidateSliders new: ${state.sliders.filter(s => s.sceneId === this.config.sceneId).map(s => s.msgId || 'undefined').join(',')}`)
    }

    async showOrUpdateSlider(ctx: ContextMessageUpdate, sliderState: SliderState<Q> = this.getSliderStateIfExists(ctx), options?: EditMessageAndButtonsOptions) {
        if (sliderState === undefined) {
            throw new Error(`Should call updateState before showOrUpdateSlider`)
        }
        return await this.showOrUpdateCard(ctx, sliderState, options)
    }

    private async showEmptyCard(ctx: ContextMessageUpdate, options?: EditMessageAndButtonsOptions): Promise<number> {
        const backButton: CallbackButton = await this.config.backButton(ctx)
        return await editMessageAndButtons(ctx, [[backButton]], this.config.noCardsText?.(ctx) ?? i18Msg(ctx, 'slider.no_more_cards'), options)
    }

    private async showOrUpdateCard(ctx: ContextMessageUpdate, state: SliderState<Q>, options?: EditMessageAndButtonsOptions): Promise<number> {
        const backButton: CallbackButton = await this.config.backButton(ctx)

        const cardId = await this.loadCardId(ctx, state, state.selectedIdx)

        if (cardId !== undefined) {

            const [event] = await this.config.loadCardsByIds(ctx, [cardId])
            if (event !== undefined) {

                this.config.analytics?.(ctx, event, {offset: state.selectedIdx, total: state.total}, state.query)

                const cardButtons: CallbackButton[] = this.config.cardButtons ? await this.config.cardButtons(ctx, event) : getLikesRow(ctx, event)

                const prevButton = Markup.callbackButton(i18nSharedBtnName('slider_keyboard.prev'), this.btnActionPrev)
                const nextButton = Markup.callbackButton(getBtnPosition(state.selectedIdx + 1, state.total), this.btnActionNext)

                const buttons: CallbackButton[][] = [
                    [prevButton, ...cardButtons],
                    [backButton, nextButton]
                ]

                const html = cardFormat(event, this.config.cardFormatOptions?.(ctx, event))

                state.msgId = await editMessageAndButtons(ctx, buttons, html, options)

                analyticRecordEventView(ctx, event)
            } else {
                state.msgId = await editMessageAndButtons(ctx, [[backButton]], i18Msg(ctx, 'slider.card_content_not_available'), options)
                ctx.logger.warn(`Cannot load card by cardId = ${cardId}`)
            }
        } else {
            state.msgId = await editMessageAndButtons(ctx, [[backButton]], i18Msg(ctx, 'slider.card_content_not_available'), options)
            ctx.logger.warn(`Cannot load cardIds. state = ${JSON.stringify(state)}`)
        }
        ctx.logger.silly(`showOrUpdateCard msgId=${state.msgId}`)
        return state.msgId
    }

    private get btnActionNext() {
        return `slider_keyboard.${this.config.sceneId}.next`
    }

    private get btnActionPrev() {
        return `slider_keyboard.${this.config.sceneId}.prev`
    }

    private async nextPrev(ctx: ContextMessageUpdate, leftRightLogic: (state: SliderState<Q>) => void) {

        function buttonTextEquals1Of1() {
            const keyboard = (ctx.update.callback_query.message as any)?.reply_markup as InlineKeyboardMarkup
            const oneOfOneBtn = keyboard.inline_keyboard.flatMap(rows => rows).find(row => row.text === getBtnPosition(1, 1))
            return oneOfOneBtn !== undefined
        }

        const state = this.getSliderStateIfExists(ctx)
        if (state !== undefined) {
            leftRightLogic(state)
            await ctx.answerCbQuery()
            if (state.total === 0) {
                await this.showEmptyCard(ctx)
            } else if (state.total !== 1 || !buttonTextEquals1Of1()) {
                await this.showOrUpdateCard(ctx, state)
            }
        } else {
            await this.answerCbSliderIsOld(ctx)
        }
    }

    private saveOrReplaceSliderState(ctx: ContextMessageUpdate, query: Q, msgId: number) {
        const nowUnix = new Date().getTime()
        const newState: SliderState<Q> = {
            msgId,
            sceneId: this.config.sceneId,
            ttl: nowUnix + botConfig.SLIDER_STATE_TTL_SECONDS * 1000,
            query: query,
            selectedIdx: 0,
            savedIds: [],
            savedIdsOffset: 0,
            total: 0,
        }
        const stateWithoutCurrentMsgId = getSliderState(ctx).sliders
            .filter(({ttl}) => ttl >= nowUnix)
            .filter(state => state.msgId !== getMsgId(ctx))
        getSliderState(ctx).sliders = [newState, ...stateWithoutCurrentMsgId].slice(0, botConfig.SLIDER_MAX_STATES_SAVED)

        ctx.logger.silly(`saveOrReplaceSliderState msgId=${msgId}`)
        return newState
    }

    private getSliderStateIfExists(ctx: ContextMessageUpdate): SliderState<Q> {
        const nowUnix = new Date().getTime()

        function isValidSlider(s: SliderState<unknown>) {
            return s.ttl === undefined || s.ttl >= nowUnix
        }

        return getSliderState(ctx).sliders.find(s => s.msgId === getMsgId(ctx) && isValidSlider(s)) as SliderState<Q>
    }

    public middleware(): MiddlewareFn<ContextMessageUpdate> {
        return (new Composer<ContextMessageUpdate>()
                .action(this.btnActionNext, async ctx => {
                    await this.nextPrev(ctx, state => {
                        if (state.selectedIdx >= state.total - 1) {
                            state.selectedIdx = 0
                        } else {
                            state.selectedIdx++
                        }
                    })
                })
                .action(this.btnActionPrev, async ctx => {
                    await this.nextPrev(ctx, state => {
                        if (state.selectedIdx <= 0) {
                            state.selectedIdx = state.total - 1
                        } else {
                            state.selectedIdx--
                        }
                    })
                })
        ).middleware()
    }

    public getSliderState(ctx: ContextMessageUpdate): Q {
        return this.getSliderStateIfExists(ctx)?.query
    }

    public isThisSliderValid(ctx: ContextMessageUpdate) {
        return this.getSliderStateIfExists(ctx) !== undefined
    }

    public async answerCbSliderIsOld(ctx: ContextMessageUpdate) {
        await ctx.answerCbQuery(i18SharedMsg(ctx, 'slider.cb_card_is_old'))
    }

}