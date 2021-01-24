import { ContextMessageUpdate, Event, MyInterval } from '../../interfaces/app-interfaces'
import { BaseScene } from 'telegraf'
import { i18nSceneHelper } from '../../util/scene-helper'
import { ScenePack } from '../../database/db-packs'
import { SessionEnforcer } from '../shared/shared-logic'
import { db } from '../../database/db'
import { addDays, max, startOfDay, startOfISOWeek } from 'date-fns/fp'
import flow from 'lodash/fp/flow'
import addMonths from 'date-fns/fp/addMonths'

export const scene = new BaseScene<ContextMessageUpdate>('packs_scene');

const {sceneHelper, actionName, i18nModuleBtnName, i18Btn, i18Msg, backButton} = i18nSceneHelper(scene)


export interface PacksSceneState {
    packs: ScenePack[]
    packSelectedIdx?: number
    eventSelectedIdx?: number
}

export function getNextRangeForPacks(now: Date): MyInterval {
    return {
        start: max([now, (flow(startOfISOWeek, startOfDay, addDays(0))(now))]),
        end: flow(startOfISOWeek, startOfDay, addMonths(1))(now)
    }
}

export async function getPacksList(ctx: ContextMessageUpdate): Promise<ScenePack[]> {
    prepareSessionStateIfNeeded(ctx)

    if (!ctx.session.packsScene?.packs) {
        ctx.session.packsScene.packs = await db.repoPacks.listPacks({
            interval: getNextRangeForPacks(ctx.now())
        })
    }
    return ctx.session.packsScene.packs;
}

export async function getPackSelected(ctx: ContextMessageUpdate): Promise<ScenePack> {
    const packs = await getPacksList(ctx)
    const scenePack = packs[ctx.session.packsScene.packSelectedIdx]
    if (scenePack === undefined) {
        throw new Error(`Cannot find pack at index=${ctx.session.packsScene.packSelectedIdx}. Packs=${packs}`)
    }
    return scenePack
}

export async function getPackEventSelected(ctx: ContextMessageUpdate): Promise<Event> {
    const pack = await getPackSelected(ctx)

    const curEventIndex = getPacksCurEventIndex(ctx)
    const eventId = pack.events.map(e => e.id)[curEventIndex]
    return await db.repoPacks.getEvent(eventId)
}


export function prepareSessionStateIfNeeded(ctx: ContextMessageUpdate) {
    const {
        packSelectedIdx,
        eventSelectedIdx,
        packs
    } = ctx.session.packsScene || {}

    ctx.session.packsScene = {
        packs,
        packSelectedIdx: SessionEnforcer.number(packSelectedIdx),
        eventSelectedIdx: SessionEnforcer.number(eventSelectedIdx),
    }
}
export function getPacksCount(ctx: ContextMessageUpdate) {
    return ctx.session.packsScene.packs.length
}

export async function getEventsCount(ctx: ContextMessageUpdate) {
    const pack = await getPackSelected(ctx)
    return pack.events.length
}

export function getPacksCurEventIndex(ctx: ContextMessageUpdate) {
    return ctx.session.packsScene.eventSelectedIdx || 0
}

export function resetPacksEventIndex(ctx: ContextMessageUpdate) {
    ctx.session.packsScene.eventSelectedIdx = undefined
}

export function resetPackIndex(ctx: ContextMessageUpdate) {
    ctx.session.packsScene.packSelectedIdx = undefined
}