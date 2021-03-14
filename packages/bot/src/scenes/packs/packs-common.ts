import { ContextMessageUpdate, DateInterval } from '../../interfaces/app-interfaces'
import { ScenePack } from '../../database/db-packs'
import { SessionEnforcer } from '../shared/shared-logic'
import { db } from '../../database/db'
import { addDays, max, startOfDay, startOfISOWeek } from 'date-fns/fp'
import flow from 'lodash/fp/flow'
import addMonths from 'date-fns/fp/addMonths'
import { Scenes } from 'telegraf'
import { botConfig } from '../../util/bot-config'

export const scene = new Scenes.BaseScene<ContextMessageUpdate>('packs_scene')

export interface PacksSceneState {
    packs: ScenePack[]
    fetchTime: number
    selectedPackId?: number
}

export function getNextRangeForPacks(now: Date): DateInterval {
    return {
        start: max([now, (flow(startOfISOWeek, startOfDay, addDays(0))(now))]),
        end: flow(startOfISOWeek, startOfDay, addMonths(1))(now)
    }
}


export async function getPacksList(ctx: ContextMessageUpdate): Promise<ScenePack[]> {
    prepareSessionStateIfNeeded(ctx)

    const nowTime = ctx.now().getTime()
    if (!ctx.session.packsScene?.packs || nowTime > ctx.session.packsScene.fetchTime + botConfig.PACKS_CACHE_TTL_SECONDS * 1000) {
        ctx.session.packsScene.fetchTime = nowTime
        ctx.session.packsScene.packs = await db.repoPacks.listPacks({
            interval: getNextRangeForPacks(ctx.now())
        })
    }
    return ctx.session.packsScene.packs;
}

export function findPackById(packs: ScenePack[], packId: number): ScenePack|undefined {
    return packs.find(p => p.id === packId)
}

export async function getPackSelected(ctx: ContextMessageUpdate): Promise<ScenePack|undefined> {
    const packs = await getPacksList(ctx)
    return findPackById(packs, ctx.session.packsScene.selectedPackId)
}

export function prepareSessionStateIfNeeded(ctx: ContextMessageUpdate) {
    const {
        selectedPackId,
        fetchTime,
        packs
    } = ctx.session.packsScene || {}

    ctx.session.packsScene = {
        packs,
        fetchTime: fetchTime || 0,
        selectedPackId: SessionEnforcer.number(selectedPackId)
    }
}
export function getPacksCount(ctx: ContextMessageUpdate) {
    return ctx.session.packsScene.packs.length
}

export async function getEventsCount(ctx: ContextMessageUpdate) {
    const pack = await getPackSelected(ctx)
    return pack?.events.length || 0
}


export function resetSelectedPack(ctx: ContextMessageUpdate) {
    ctx.session.packsScene.selectedPackId = undefined
}

export function resetPacksCache(ctx: ContextMessageUpdate) {
    ctx.session.packsScene = undefined
}