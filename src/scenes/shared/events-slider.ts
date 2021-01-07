import { ContextMessageUpdate, Event } from '../../interfaces/app-interfaces'

export interface EventsSliderState {
    selectedIdx?: number
}

export interface SliderConfig {
    getState(ctx: ContextMessageUpdate): EventsSliderState

    prepareList(ctx: ContextMessageUpdate): Promise<number[]>

    loadEvent(ctx: ContextMessageUpdate, eventId: number): Promise<Event[]>

    getTotal(ctx: ContextMessageUpdate): Promise<number>
}

export class EventsSlider {
    state: EventsSliderState
    ctx: ContextMessageUpdate

    constructor(ctx: ContextMessageUpdate, state: EventsSliderState) {
        this.state = state
    }

    curIndex() {
        return this.state.selectedIdx || 0
    }

    resetIndex() {
        this.state.selectedIdx = undefined
    }

}