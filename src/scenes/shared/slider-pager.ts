import { ContextMessageUpdate, Event } from '../../interfaces/app-interfaces'
import { MiddlewareFn } from 'telegraf/typings/composer'
import { BaseScene, Composer, Markup } from 'telegraf'
import { editMessageAndButtons, getMsgId } from './shared-logic'
import { getLikesRow } from '../likes/likes-common'
import { cardFormat } from './card-format'
import { analyticRecordEventView } from '../../lib/middleware/analytics-middleware'
import { i18nSceneHelper } from '../../util/scene-helper'
import { CallbackButton } from 'telegraf/typings/markup'
import { logger } from '../../util/logger'
import { EventsPagerSliderBase, PagerSliderState, PagingCommonConfig } from './events-common'
import { LimitOffset } from '../../database/db'

const scene = new BaseScene<ContextMessageUpdate>('')
const {sceneHelper, i18nSharedBtnName, actionName, i18Btn, i18Msg, i18SharedMsg} = i18nSceneHelper(scene)

const MAX_STATES_SAVED = 2

export interface SliderState<Q> extends PagerSliderState<Q> {
    msgId: number
}

export interface AllSlidersState {
    sliders: SliderState<unknown>[]
}

export interface SliderConfig<Q, E extends Event = Event> extends PagingCommonConfig<Q, E> {
    backButton(ctx: ContextMessageUpdate): CallbackButton

    analytics?(ctx: ContextMessageUpdate, event: Event, {limit, offset}: LimitOffset, state: Q): void
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

export class SliderPager<Q, E extends Event = Event> extends EventsPagerSliderBase<Q, SliderConfig<Q, E>, E> {

    async updateState(ctx: ContextMessageUpdate, state: Q, total: number = undefined, bindMsgId: number | undefined = undefined) {
        const sliderState = this.saveOrReplaceSliderState(ctx, state, bindMsgId)
        sliderState.total = total ?? await this.config.getTotal(ctx, sliderState.query)
        return sliderState
    }

    tryRestoreStateFromMsg(ctx: ContextMessageUpdate): Q | undefined {
        return this.getSliderStateIfExists(ctx)?.query
    }

    async showOrUpdateSlider(ctx: ContextMessageUpdate, sliderState: SliderState<Q> = this.getSliderStateIfExists(ctx)) {
        if (sliderState === undefined) {
            throw new Error(`Should call updateState before showOrUpdateSlider`)
        }
        return await this.showOrUpdateCard(ctx, sliderState)
    }

    private async showOrUpdateCard(ctx: ContextMessageUpdate, state: SliderState<Q>): Promise<number> {
        const backButton: CallbackButton = await this.config.backButton(ctx)

        const cardId = await this.loadCardId(ctx, state, state.selectedIdx)

        if (cardId !== undefined) {

            const [event] = await this.config.loadCardsByIds(ctx, [cardId])
            if (event !== undefined) {

                this.config.analytics?.(ctx, event, {offset: state.selectedIdx, limit: state.total}, state.query)

                const cardButtons: CallbackButton[] = this.config.cardButtons ? await this.config.cardButtons(ctx, event) : getLikesRow(ctx, event)

                const prevButton = Markup.callbackButton(i18nSharedBtnName('slider_keyboard.prev'), this.btnActionPrev)
                const nextButton = Markup.callbackButton(i18nSharedBtnName('slider_keyboard.next', {
                    position: i18nSharedBtnName('slider_keyboard.position', {
                        page: state.selectedIdx + 1,
                        total: state.total
                    })
                }), this.btnActionNext)

                const buttons: CallbackButton[][] = [
                    [prevButton, ...cardButtons],
                    [backButton, nextButton]
                ]

                const html = cardFormat(event, this.config.cardFormatOptions?.(ctx, event))

                state.msgId = await editMessageAndButtons(ctx, buttons, html)

                analyticRecordEventView(ctx, event)
            } else {
                state.msgId = await editMessageAndButtons(ctx, [[backButton]], 'Данная карточка больше недоступна')
                logger.warn(`Cannot load card by cardId = ${cardId}`)
            }
        } else {
            state.msgId = await editMessageAndButtons(ctx, [[backButton]], 'Данная карточка больше недоступна')
            logger.warn(`Cannot load cardIds. state = ${JSON.stringify(state)}`)
        }
        return state.msgId
    }

    private get btnActionNext() {
        return `slider_keyboard.${this.config.sceneId}.next`
    }

    private get btnActionPrev() {
        return `slider_keyboard.${this.config.sceneId}.prev`
    }

    private async nextPrev(ctx: ContextMessageUpdate, leftRightLogic: (state: SliderState<Q>) => void) {
        const state = this.getSliderStateIfExists(ctx)
        if (state !== undefined) {
            leftRightLogic(state)
            await ctx.answerCbQuery()
            if (state.total !== 1) {
                await this.showOrUpdateCard(ctx, state)
            }
        } else {
            await ctx.answerCbQuery('Карточка устарела, не можем найти сообщение id=' + getMsgId(ctx))
        }
    }

    private saveOrReplaceSliderState(ctx: ContextMessageUpdate, query: Q, msgId: number) {
        const newState: SliderState<Q> = {
            msgId,
            query: query,
            selectedIdx: 0,
            savedIds: [],
            savedIdsOffset: 0,
            total: 0,
        }
        const stateWithoutCurrentMsgId = getSliderState(ctx).sliders.filter(state => state.msgId !== getMsgId(ctx))
        getSliderState(ctx).sliders = [newState, ...stateWithoutCurrentMsgId.slice(0, MAX_STATES_SAVED)]
        return newState
    }

    private getSliderStateIfExists(ctx: ContextMessageUpdate): SliderState<Q> {
        return getSliderState(ctx).sliders.find(s => s.msgId === getMsgId(ctx)) as SliderState<Q>
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
}