import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { CardOptions } from './card-format'

import { LimitOffsetLast } from '../../database/db'
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

    /**
     * Returns ids of cards by query Q
     * @param ctx
     * @param limitOffset
     * @param query
     */
    preloadIds(ctx: ContextMessageUpdate, limitOffset: LimitOffsetLast, query: Q): Promise<number[]>

    loadCardsByIds(ctx: ContextMessageUpdate, eventIds: number[]): Promise<E[]>
}

