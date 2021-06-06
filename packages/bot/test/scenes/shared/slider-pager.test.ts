import { SliderConfig, SliderPager } from '../../../src/scenes/shared/slider-pager'
import { ContextMessageUpdate, Event } from '../../../src/interfaces/app-interfaces'
import { LimitOffset } from '../../../src/database/db'
import { MOCK_EVENT } from '../../util/mock-bot-objects'
import { TelegramCtxMock } from '../../util/telegram-ctx-mock'
import { botConfig } from '../../../src/util/bot-config'

describe('Event slider', () => {

    const initCtx = TelegramCtxMock.createFromInlineClick('')

    beforeEach(() => {
        botConfig.SLIDER_MAX_IDS_CACHED = 2

        initCtx.session = {
            user: {
                id: 0,
                showTags: false,
                clicks: 0,
                eventsFavorite: [],
                lastDbUpdated: 0,
                version: ''
            },
            __scenes: undefined
        }
    })

    test('No events', async () => {
        const sliderPager = new SliderPager(new TestDualConfig([]))

        const state = await sliderPager.updateState(initCtx, {
            state: null
        })
        const msgId = await sliderPager.showOrUpdateSlider(initCtx, state, {forceNewMsg: true})
    })

    test('if there is one card and I click previous, nothing bad is happens (this tests if onlyOneEventLeftAccordingToButtons is working)', async () => {
        const sliderPager = new SliderPager(new TestDualConfig([MOCK_EVENT]))

        await sliderPager.showOrUpdateSlider(initCtx, await sliderPager.updateState(initCtx, {state: null}), {forceNewMsg: true})
        const clickPrevCtx = TelegramCtxMock.createFromInlineClick(`slider_keyboard.test.prev`, initCtx.findLastReply().message)
            .continueSessionFrom(initCtx)
            .continueServerStateFrom(initCtx)

        await sliderPager.middleware()(clickPrevCtx, async () => null)
        expect(clickPrevCtx.isNotModifiedError()).toBeFalsy()
    })

})

class TestDualConfig implements SliderConfig<null> {
    readonly sceneId = 'test'
    private readonly events: Event[]

    constructor(events: Event[]) {
        this.events = events
    }

    async getTotal(ctx: ContextMessageUpdate): Promise<number> {
        return this.events.length
    }

    async loadCardsByIds(ctx: ContextMessageUpdate, indexes: number[]): Promise<Event[]> {
        return indexes.map(i => this.events[i])
    }

    async preloadIds(ctx: ContextMessageUpdate, limitOffset: LimitOffset): Promise<number[]> {
        const result = []
        for (let i = limitOffset.offset; i < Math.min(limitOffset.offset + limitOffset.limit, this.events.length); i++) {
            result.push(i)
        }
        return result
    }

    backButtonCallbackData(ctx: ContextMessageUpdate): string {
        return 'dummy'
    }
}