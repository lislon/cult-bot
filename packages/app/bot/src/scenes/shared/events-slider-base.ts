import { ContextMessageUpdate, Event } from '../../interfaces/app-interfaces'
import { botConfig } from '../../util/bot-config'
import { PagerSliderState, PagingCommonConfig } from './events-common'

export class EventsPagerSliderBase<Q, C extends PagingCommonConfig<Q, E>, E extends Event> {
    protected readonly config: C

    constructor(config: C) {
        this.config = config
    }

    protected async loadCardId(ctx: ContextMessageUpdate, state: PagerSliderState<Q>, index: number): Promise<number | undefined> {
        if (index < 0 || index >= state.total) {
            return undefined
        }

        const maxIdSaved = this.config.maxIdsToCache?.(ctx) || botConfig.SLIDER_MAX_IDS_CACHED

        const lastSavedIdIndex = state.savedIdsOffset + state.savedIds.length
        const currentId = state.savedIds[index - state.savedIdsOffset]

        if (index >= lastSavedIdIndex || index < state.savedIdsOffset) {
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