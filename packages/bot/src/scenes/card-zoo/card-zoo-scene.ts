import { Composer, Scenes } from 'telegraf'
import { SliderConfig, SliderPager } from '../shared/slider-pager'
import { ContextMessageUpdate, Event } from '../../interfaces/app-interfaces'
import { LimitOffset } from '../../database/db'
import { i18nSceneHelper, isAdmin } from '../../util/scene-helper'
import { SceneRegister } from '../../middleware-utils'
import { cardDesignLibrary } from '../../lib/card-format/card-design-library'
import { replyWithBackToMainMarkup } from '../shared/shared-logic'
import { CardOptions } from '../shared/card-format'
import { isEventInFavorites } from '../likes/likes-common'


const scene = new Scenes.BaseScene<ContextMessageUpdate>('card_zoo_scene')
const {sceneHelper, i18nSharedBtnName, actionName, i18Btn, i18Msg, i18SharedMsg, backButton} = i18nSceneHelper(scene)

const library = cardDesignLibrary();

export class CardCatalogueConfig implements SliderConfig<null> {
    readonly limit = 1
    readonly sceneId = scene.id

    async getTotal(ctx: ContextMessageUpdate): Promise<number> {
        return library.length
    }

    async loadCardsByIds(ctx: ContextMessageUpdate, indexes: number[]): Promise<Event[]> {
        return indexes.map(i => library[i].row)
    }

    async preloadIds(ctx: ContextMessageUpdate, limitOffset: LimitOffset): Promise<number[]> {
        const result = []
        for (let i = limitOffset.offset; i < Math.min(limitOffset.offset + limitOffset.limit, library.length); i++) {
            result.push(i)
        }
        return result
    }

    cardFormatOptions(ctx: ContextMessageUpdate, event: Event): CardOptions {
        const options = library.find(s => s.row.id === event.id).options
        return options
    }

    backButtonCallbackData(ctx: ContextMessageUpdate): string {
        return backButton().callback_data
    }
}

const slider = new SliderPager(new CardCatalogueConfig())

scene
    .enter(async ctx => {
        await replyWithBackToMainMarkup(ctx, i18Msg(ctx, 'welcome'))
        const state = await slider.updateState(ctx, { state: null })
        await slider.showOrUpdateSlider(ctx, state, {forceNewMsg: true})
    })
    .use(slider.middleware())

function postStageActionsFn(bot: Composer<ContextMessageUpdate>): void {
    bot
        .command('cardzoo', async ctx => {
            if (isAdmin(ctx)) {
                await ctx.scene.enter('card_zoo_scene')
            }
        })
}

export const cardZooScene : SceneRegister = {
    scene,
    postStageActionsFn
}