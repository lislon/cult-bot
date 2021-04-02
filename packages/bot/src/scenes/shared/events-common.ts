import { ContextMessageUpdate, Event } from '../../interfaces/app-interfaces'
import { CardOptions } from './card-format'

import { LimitOffsetLast } from '../../database/db'
import { botConfig } from '../../util/bot-config'
import { InlineKeyboardButton } from 'typegram'

export interface PagerSliderState<Q> {
    selectedIdx: number
    query?: Q
    savedIds: number[]
    savedIdsOffset: number
    total: number
}

export interface PagingCommonConfig<Q, E> {
    sceneId: string

    maxIdsToCache?(ctx: ContextMessageUpdate): number

    cardFormatOptions?(ctx: ContextMessageUpdate, event: E): Omit<CardOptions, 'now'>

    getTotal(ctx: ContextMessageUpdate, query: Q): Promise<number>

    noResults?(ctx: ContextMessageUpdate): Promise<void>

    cardButtons?(ctx: ContextMessageUpdate, event: E): Promise<InlineKeyboardButton.CallbackButton[]>

    preloadIds(ctx: ContextMessageUpdate, limitOffset: LimitOffsetLast, query: Q): Promise<number[]>

    loadCardsByIds(ctx: ContextMessageUpdate, eventIds: number[]): Promise<E[]>
}

export class EventsPagerSliderBase<Q, C extends PagingCommonConfig<Q, E>, E extends Event> {
    protected readonly config: C

    constructor(config: C) {
        this.config = config
    }

    protected async loadCardId(ctx: ContextMessageUpdate, state: PagerSliderState<Q>, index: number): Promise<number | undefined> {
        if (index < 0 || index >= state.total) {
            throw new Error(`Out of index: ` + JSON.stringify(state))
        }

        const maxIdSaved = this.config.maxIdsToCache?.(ctx) || botConfig.SLIDER_MAX_IDS_CACHED

        const rightEnd = state.savedIdsOffset + state.savedIds.length
        const currentId = state.savedIds[index - state.savedIdsOffset]

        if (index >= rightEnd || index < state.savedIdsOffset) {
            state.savedIdsOffset = index - index % maxIdSaved
            state.savedIds = await this.config.preloadIds(ctx, {
                lastId: currentId,
                limit: maxIdSaved,
                offset: state.savedIdsOffset
            }, state.query)
            // state.total = await this.config.getTotal(ctx, state.query)
        }

        return state.savedIds[index - state.savedIdsOffset]
    }

}