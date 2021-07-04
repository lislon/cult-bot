import { ContextMessageUpdate, Event, DateInterval } from '../../interfaces/app-interfaces'
import { db, LimitOffset } from '../../database/db'
import { SliderConfig, TotalOffset } from '../shared/slider-pager'
import { Scenes } from 'telegraf'
import { getNextRangeForPacks } from './packs-common'
import { mySlugify } from '../shared/shared-logic'
import emojiRegex from 'emoji-regex'
import { ScenePack } from '../../database/db-packs'
import { isAdmin } from '../../util/scene-utils'
import { i18nSceneHelper } from '../../util/scene-helper'

const scene = new Scenes.BaseScene<ContextMessageUpdate>('packs_scene')
const {i18Msg, actionName} = i18nSceneHelper(scene)

export class PackEventPagerConfig implements SliderConfig<number> {
    readonly limit = 1
    readonly sceneId = scene.id

    async getTotal(ctx: ContextMessageUpdate, packId: number): Promise<number> {
        const scenePack = ctx.session.packsScene.packs.find(p => p.id === packId)
        return scenePack?.events.length || 0
    }

    async loadCardsByIds(ctx: ContextMessageUpdate, eventIds: number[]): Promise<Event[]> {
        return await db.repoEventsCommon.getEventsByIds(eventIds)
    }

    async preloadIds(ctx: ContextMessageUpdate, limitOffset: LimitOffset, packId: number): Promise<number[]> {
        const scenePack = this.getPackById(ctx, packId)
        return scenePack?.events.map(e => e.id).slice(limitOffset.offset, limitOffset.offset + limitOffset.limit) || []
    }

    noCardsText(ctx: ContextMessageUpdate) {
        return i18Msg(ctx, 'slider_is_empty')
    }

    async noResults(ctx: ContextMessageUpdate) {
        await ctx.replyWithHTML(i18Msg(ctx, 'no_results'))
    }

    backButtonCallbackData(ctx: ContextMessageUpdate): string {
        return actionName(`event_back`)
    }

    analytics(ctx: ContextMessageUpdate, event: Event, {total, offset}: TotalOffset, packId: number): void {
        const packTitleNoEmoji = this.getPackById(ctx, packId)?.title?.replace(emojiRegex(), '')?.trim() || '???'
        ctx.ua.pv({
            dp: `/packs/${mySlugify(packTitleNoEmoji)}/p${offset + 1}/${mySlugify(event.extId)}`,
            dt: `Подборки > ${packTitleNoEmoji} > ${event.title} [${offset + 1}/${total}]`
        })
    }

    private getPackById(ctx: ContextMessageUpdate, packId: number): ScenePack | undefined {
        return ctx.session.packsScene.packs.find(p => p.id === packId)
    }
}
