import { ContextMessageUpdate, Event } from '../../interfaces/app-interfaces'
import { BaseScene, Extra, Markup } from 'telegraf'
import { i18nSceneHelper } from '../../util/scene-helper'
import { CallbackButton } from 'telegraf/typings/markup'
import { logger } from '../../util/logger'
import { ScenePack } from '../../database/db-packs'
import { getNextWeekRange, SessionEnforcer } from '../shared/shared-logic'
import { db } from '../../database/db'

export const scene = new BaseScene<ContextMessageUpdate>('packs_scene');

const {sceneHelper, actionName, i18nModuleBtnName, i18Btn, i18Msg, backButton} = i18nSceneHelper(scene)

export interface PacksSceneState {
    msgId?: number
    lastText?: string
    lastMarkup?: CallbackButton[][]
    packs: ScenePack[]
    packSelectedIdx?: number
    eventSelectedIdx?: number
}

export interface UpdateMenu {
    text: string,
    buttons: CallbackButton[][]
}

export async function updateMenu(ctx: ContextMessageUpdate, upd: UpdateMenu) {

    let response;
    if (ctx.session.packsScene.msgId === undefined) {
        response = await ctx.replyWithHTML(upd.text, {
                ...Extra.markup(Markup.inlineKeyboard(upd.buttons)),
                disable_web_page_preview: true
            }
        )
    } else {

        if (ctx.session.packsScene.lastText === upd.text && JSON.stringify(ctx.session.packsScene.lastMarkup) === JSON.stringify(upd.buttons)) {
            logger.debug('message not changed')
            return
        }

        response = await ctx.editMessageText(upd.text, Extra.HTML()
            .webPreview(false)
            .markup(Markup.inlineKeyboard(upd.buttons)))
    }
    if (typeof response !== 'boolean') {
        ctx.session.packsScene.msgId = response.message_id
        ctx.session.packsScene.lastText = upd.text
        ctx.session.packsScene.lastMarkup = upd.buttons
    }
}

export async function getPacksList(ctx: ContextMessageUpdate): Promise<ScenePack[]> {
    prepareSessionStateIfNeeded(ctx)

    if (!ctx.session.packsScene?.packs) {
        ctx.session.packsScene.packs = await db.repoPacks.listPacks({
            interval: getNextWeekRange(ctx.now())
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

export async function getEventSelected(ctx: ContextMessageUpdate): Promise<Event> {
    const pack = await getPackSelected(ctx)

    const curEventIndex = getCurEventIndex(ctx)
    const eventId = pack.events.map(e => e.id)[curEventIndex]
    const event = await db.repoPacks.getEvent(eventId)
    return event
}


export function prepareSessionStateIfNeeded(ctx: ContextMessageUpdate) {
    const {
        msgId,
        lastText,
        lastMarkup,
        packSelectedIdx,
        eventSelectedIdx,
        packs
    } = ctx.session.packsScene || {}

    ctx.session.packsScene = {
        msgId,
        lastText,
        lastMarkup,
        packs,
        packSelectedIdx: SessionEnforcer.number(packSelectedIdx),
        eventSelectedIdx: SessionEnforcer.number(eventSelectedIdx),
    }
}

export function getCurPackIndex(ctx: ContextMessageUpdate) {
    return ctx.session.packsScene.packSelectedIdx || 0
}

export function getPacksCount(ctx: ContextMessageUpdate) {
    return ctx.session.packsScene.packs.length
}

export async function getEventsCount(ctx: ContextMessageUpdate) {
    const pack = await getPackSelected(ctx)
    return pack.events.length
}

export function getCurEventIndex(ctx: ContextMessageUpdate) {
    return ctx.session.packsScene.eventSelectedIdx || 0
}

export function resetEventIndex(ctx: ContextMessageUpdate) {
    ctx.session.packsScene.eventSelectedIdx = undefined
}

export function resetPackIndex(ctx: ContextMessageUpdate) {
    ctx.session.packsScene.packSelectedIdx = undefined
}

