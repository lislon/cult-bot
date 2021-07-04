import { ContextCallbackQueryUpdate, ContextMessageUpdate, Event } from '../../interfaces/app-interfaces'
import { Composer, Markup, MiddlewareFn, Scenes } from 'telegraf'
import {
    editMessageAndButtons,
    EditMessageAndButtonsOptions,
    getInlineKeyboardFromCallbackQuery,
    getMsgId,
    updateKeyboardButtons
} from './shared-logic'
import { getLikesRow } from '../likes/likes-common'
import { cardFormat } from './card-format'
import { analyticRecordEventView } from '../../lib/middleware/analytics-middleware'
import { PagerSliderState, PagingCommonConfig } from './events-common'
import { botConfig } from '../../util/bot-config'
import { InlineKeyboardButton } from 'typegram'
import { EventsPagerSliderBase } from './events-slider-base'
import { isAdmin } from '../../util/scene-utils'
import { i18nSceneHelper } from '../../util/scene-helper'

const scene = new Scenes.BaseScene<ContextMessageUpdate>('')
const {sceneHelper, i18nSharedBtnName, actionName, i18Btn, i18SharedMsg} = i18nSceneHelper(scene)

export interface SliderState<Q> extends PagerSliderState<Q> {
    msgId: number
    sceneId: string
    createdAt: number
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

    backButtonCallbackData(ctx: ContextMessageUpdate): string

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

function formatPositionText(page: number, total: number): string {
    return i18nSharedBtnName('slider_keyboard.next', {
        page: page,
        total: total
    })
}

export interface UpdateData<Q> {
    state?: Q
    total?: number
    msgId?: number
    invalidateOtherSliders?: boolean
}

interface ButtonsAndText {
    text: string
    buttons: InlineKeyboardButton.CallbackButton[][]
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

    async showOrUpdateSlider(ctx: ContextMessageUpdate, sliderState: SliderState<Q> = this.getSliderStateIfExists(ctx), options?: EditMessageAndButtonsOptions): Promise<number> {
        if (sliderState === undefined) {
            throw new Error(`Should call updateState before showOrUpdateSlider`)
        }
        return await this.showOrUpdateCard(ctx, sliderState, options)
    }

    private async getEmptyCard(ctx: ContextMessageUpdate, options?: EditMessageAndButtonsOptions) {
        return {
            buttons: [[await this.getBackButton(ctx)]],
            text: this.config.noCardsText?.(ctx) ?? i18SharedMsg(ctx, 'slider.no_more_cards')
        }
    }

    private async getBackButton(ctx: ContextMessageUpdate) {
        return Markup.button.callback(i18nSharedBtnName('slider_keyboard.back'), await this.config.backButtonCallbackData(ctx))
    }

    private async showOrUpdateCard(ctx: ContextMessageUpdate, state: SliderState<Q>, options?: EditMessageAndButtonsOptions): Promise<number> {
        const cardId = await this.loadCardId(ctx, state, state.selectedIdx)

        const {buttons, text} = (cardId !== undefined) ? await this.handleExistingCard(ctx, cardId, state) : await this.handleOutOfBoundsCard(ctx, state)

        state.msgId = await editMessageAndButtons(ctx, buttons, text, options)

        ctx.logger.silly(`showOrUpdateCard msgId=${state.msgId}`)
        return state.msgId
    }

    private async handleExistingCard(ctx: ContextMessageUpdate, cardId: number, state: SliderState<Q>): Promise<ButtonsAndText> {
        const backButton: InlineKeyboardButton.CallbackButton = await this.getBackButton(ctx)
        const [event] = await this.config.loadCardsByIds(ctx, [cardId])
        if (event !== undefined) {

            this.config.analytics?.(ctx, event, {offset: state.selectedIdx, total: state.total}, state.query)

            const cardButtons: InlineKeyboardButton.CallbackButton[] = this.config.cardButtons ? await this.config.cardButtons(ctx, event) : getLikesRow(ctx, event)


            const prevButton = Markup.button.callback(i18nSharedBtnName('slider_keyboard.prev'), this.btnActionPrev)
            const position = Markup.button.callback('#', this.btnActionPosition)
            const nextButton = Markup.button.callback(formatPositionText(state.selectedIdx + 1, state.total), this.btnActionNext)

            let buttons: InlineKeyboardButton.CallbackButton[][] = []

            buttons = [
                [backButton, ...cardButtons],
                [prevButton, position, nextButton]
            ]

            const text = cardFormat(event, {
                showDetails: ctx.session.user.showTags,
                now: ctx.now(),
                showAdminInfo: isAdmin(ctx),
                ...this.config.cardFormatOptions?.(ctx, event)
            })
            analyticRecordEventView(ctx, event)
            return {buttons, text}
        } else {
            ctx.logger.warn(`Cannot load card by cardId = ${cardId}`)
            return {buttons: [[backButton]], text: i18SharedMsg(ctx, 'slider.card_content_not_available')}
        }
    }

    private async handleOutOfBoundsCard(ctx: ContextMessageUpdate, state: SliderState<Q>): Promise<ButtonsAndText> {
        state.total = await this.config.getTotal(ctx, state.query)
        state.savedIds = []
        state.savedIdsOffset = 0
        state.selectedIdx = 0
        if (state.total === 0) {
            ctx.logger.warn(`Cannot load cardIds. state = ${JSON.stringify(state)}. Total=${state.total}. Show empty card`)
            return this.getEmptyCard(ctx)
        } else {
            const cardId = await this.loadCardId(ctx, state, state.selectedIdx)
            if (cardId !== undefined) {
                const buttonsAndText = await this.handleExistingCard(ctx, cardId, state)
                buttonsAndText.text += i18SharedMsg(ctx, `slider.reset_to_zero_postfix`)

                buttonsAndText.buttons = (await updateKeyboardButtons(
                    {inline_keyboard: buttonsAndText.buttons},
                    /^slider_keyboard[.].+[.]next$/, (btn) => {
                        btn.text = `* ${btn.text}`
                        return btn
                    })).inline_keyboard as InlineKeyboardButton.CallbackButton[][]

                return buttonsAndText
            } else {
                return {
                    buttons: [[await this.getBackButton(ctx)]],
                    text: i18SharedMsg(ctx, 'slider.card_content_not_available')
                }
            }
        }
    }

    private get btnActionNext() {
        return `slider_keyboard.${this.config.sceneId}.next`
    }

    private get btnActionPosition() {
        return `slider_keyboard.${this.config.sceneId}.position`
    }

    private get btnActionPrev() {
        return `slider_keyboard.${this.config.sceneId}.prev`
    }

    private async nextPrev(ctx: ContextCallbackQueryUpdate, nextPrevIndexUpdateLogic: (state: SliderState<Q>) => void) {

        function onlyOneEventLeftAccordingToButtons() {
            const keyboard = getInlineKeyboardFromCallbackQuery(ctx)
            const oneOfOneBtn = keyboard.inline_keyboard.flatMap(rows => rows).find(row => row.text === formatPositionText(1, 1))
            return oneOfOneBtn !== undefined
        }

        const state = this.getSliderStateIfExists(ctx)
        if (state !== undefined) {
            nextPrevIndexUpdateLogic(state)
            await ctx.answerCbQuery()
            if (state.total === 0) {
                const {text, buttons} = await this.getEmptyCard(ctx)
                state.msgId = await editMessageAndButtons(ctx, buttons, text)
            } else if (state.total !== 1 || !onlyOneEventLeftAccordingToButtons()) {
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
            createdAt: nowUnix,
            query: query,
            selectedIdx: 0,
            savedIds: [],
            savedIdsOffset: 0,
            total: 0,
        }
        const stateWithoutCurrentMsgId = getSliderState(ctx).sliders
            .filter(this.isNotExpired)
            .filter(state => state.msgId !== getMsgId(ctx))
        getSliderState(ctx).sliders = [newState, ...stateWithoutCurrentMsgId].slice(0, botConfig.SLIDER_MAX_STATES_SAVED)

        ctx.logger.silly(`saveOrReplaceSliderState msgId=${msgId}`)
        return newState
    }

    private getSliderStateIfExists(ctx: ContextMessageUpdate): SliderState<Q> {
        const sliderState = this.getValidStageSliders(ctx).find(s => s.msgId === getMsgId(ctx)) as SliderState<Q>
        return sliderState
    }

    private getValidStageSliders(ctx: ContextMessageUpdate): SliderState<Q>[] {
        return (getSliderState(ctx).sliders)
            .filter(s => s.sceneId === this.config.sceneId)
            .filter(this.isNotExpired) as SliderState<Q>[]
    }

    private isNotExpired(s: SliderState<unknown>): boolean {
        return s.createdAt + botConfig.SLIDER_STATE_TTL_SECONDS * 1000 >= new Date().getTime()
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
                .action(this.btnActionPosition, async ctx => {
                    await ctx.answerCbQuery()
                    ctx.session.user.showTags = !ctx.session.user.showTags
                    if (ctx.session.user.showTags) {
                        ctx.ua.event('Button', 'tag_show', '# (Show)', undefined)
                    } else {
                        ctx.ua.event('Button', 'tag_hide', '# (Hide)', undefined)
                    }

                    const state = this.getSliderStateIfExists(ctx)
                    if (state !== undefined) {
                        // const eventId = +ctx.match[1]
                        // const { buttons, text } = await this.handleExistingCard(ctx, eventId, state)
                        await this.showOrUpdateCard(ctx, state)
                    } else {
                        await this.answerCbSliderIsOld(ctx)
                    }
                })
        ).middleware()
    }

    public getSliderState(ctx: ContextMessageUpdate): Q | undefined {
        return this.getSliderStateIfExists(ctx)?.query
    }

    public isThisSliderValid(ctx: ContextMessageUpdate): boolean {
        return this.getSliderStateIfExists(ctx) !== undefined
    }

    public getActiveSliderState(ctx: ContextMessageUpdate): SliderState<Q> | undefined {
        const [activeSlider] = this.getValidStageSliders(ctx)
        return activeSlider
    }

    public async answerCbSliderIsOld(ctx: ContextMessageUpdate): Promise<void> {
        await ctx.answerCbQuery(i18SharedMsg(ctx, 'slider.cb_card_is_old'))
    }

}