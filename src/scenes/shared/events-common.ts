import { ContextMessageUpdate, Event } from '../../interfaces/app-interfaces'
import { CardOptions } from './card-format'
import { CallbackButton } from 'telegraf/typings/markup'
import { LimitOffset } from '../../database/db'

const MAX_IDS_SAVED = 10

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

    cardFormatOptions?(ctx: ContextMessageUpdate, event: E): CardOptions

    getTotal(ctx: ContextMessageUpdate, query: Q): Promise<number>

    noResults?(ctx: ContextMessageUpdate): Promise<void>

    cardButtons?(ctx: ContextMessageUpdate, event: E): Promise<CallbackButton[]>

    preloadIds(ctx: ContextMessageUpdate, query: Q, limitOffset: LimitOffset): Promise<number[]>

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

        const maxIdSaved = this.config.maxIdsToCache?.(ctx) || MAX_IDS_SAVED

        const rightEnd = state.savedIdsOffset + state.savedIds.length

        if (index >= rightEnd || index < state.savedIdsOffset) {
            state.savedIdsOffset = index - index % maxIdSaved
            state.savedIds = await this.config.preloadIds(ctx, state.query, {
                limit: maxIdSaved,
                offset: state.savedIdsOffset
            })
            // state.total = await this.config.getTotal(ctx, state.query)
        }

        return state.savedIds[index - state.savedIdsOffset]
    }

}