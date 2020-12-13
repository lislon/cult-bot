import { ContextMessageUpdate, Event } from '../../interfaces/app-interfaces'
import { BaseScene, Markup } from 'telegraf'
import { i18nSceneHelper } from '../../util/scene-helper'
import { CallbackButton } from 'telegraf/typings/markup'
import { InputFile } from 'telegraf/typings/telegram-types'
import { redis } from '../../util/reddis'
import { promisify } from 'util'
import { logger } from '../../util/logger'
import { ScenePack } from '../../database/db-packs'
import { getNextWeekRange, SessionEnforcer } from '../shared/shared-logic'
import { db } from '../../database/db'
import md5 from 'md5'

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
    imgCacheId: string
    imgLoad: () => Promise<InputFile>,
    text: string,
    buttons: CallbackButton[][]
}

const redisGET = promisify(redis.get.bind(redis))
const redisSet: (id: string, value: any) => Promise<void> = promisify(redis.set.bind(redis)) as any
const redisExpire = promisify(redis.expire.bind(redis))
const EXPIRE_IMG_CACHE_SECONDS = 3600 * 24

export async function updateMenu(ctx: ContextMessageUpdate, upd: UpdateMenu) {

    const imageCacheId = `packs:img_${md5(upd.imgCacheId)}`
    const imageFileId = await redisGET(imageCacheId)

    const media = imageFileId !== null ? imageFileId : await upd.imgLoad()

    let response;
    if (ctx.session.packsScene.msgId === undefined) {
        response = await ctx.replyWithPhoto(media, {
            caption: upd.text,
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard(upd.buttons)
        })
    } else {

        if (ctx.session.packsScene.lastText === upd.text && JSON.stringify(ctx.session.packsScene.lastMarkup) === JSON.stringify(upd.buttons)) {
            logger.debug('message not changed')
            return
        }

        response = await ctx.editMessageMedia({
            type: 'photo',
            media,
            caption: upd.text
        }, {
            reply_markup: Markup.inlineKeyboard(upd.buttons),
            parse_mode: 'HTML'
        })


        // if (ctx.session.packsScene.lastText !== upd.text) {
        //     await ctx.editMessageText(upd.text, {
        //         parse_mode: 'HTML'
        //     })
        //     ctx.session.packsScene.lastText = upd.text
        // }
    }
    if (typeof response !== 'boolean') {
        if (imageFileId === null) {
            await redisSet(imageCacheId, response.photo[0].file_id)
            await redisExpire(imageCacheId, EXPIRE_IMG_CACHE_SECONDS)
        }
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

