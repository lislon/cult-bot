import { BaseScene, Telegraf } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { i18nSceneHelper } from '../../util/scene-helper'
import middlewares, { SceneRegister } from '../../middleware-utils'
import { InputFile } from 'telegraf/typings/telegram-types'
import { createReadStream } from 'fs'
import path from 'path'
import { redisSession } from '../../util/reddis'
import { countInteractions } from '../../lib/middleware/analytics-middleware'

const scene = new BaseScene<ContextMessageUpdate>('help_scene');
const {i18Msg} = i18nSceneHelper(scene)

let cached_help_file_id = ''

function postStageActionsFn(bot: Telegraf<ContextMessageUpdate>) {
    bot
        .use(middlewares.logMiddleware('postStageActionsFn scene: ' + scene.id))
        .help(async (ctx) => {
            ctx.ua.pv({dp: '/help', dt: 'Помощь'})

            let file: InputFile
            if (cached_help_file_id === '') {
                file = {source: createReadStream(path.resolve(__dirname, './assets/help.png'))}
            } else {
                file = cached_help_file_id
            }
            try {
                const result = await ctx.replyWithPhoto(file, {
                    caption: i18Msg(ctx, 'help')
                })
                if (result.photo.length > 0) {
                    cached_help_file_id = result.photo[0].file_id
                }
            } catch (e) {
                cached_help_file_id = ''
                throw e
            }
        })
        .command('reset', async (ctx, next) => {
            ctx.session.help = undefined
            ctx.session.analytics.markupClicks = 0
            ctx.session.analytics.inlineClicks = 0
            await ctx.replyWithHTML(i18Msg(ctx, 'reset'))
        })
}

function preSceneGlobalActionsFn(bot: Telegraf<ContextMessageUpdate>) {
    bot
        .hears(/.+/, async (ctx, next) => {
            try {
                throttleActionsToShowHelpForNewComers(ctx)
            } finally {
                await next()
            }
        })
        .action(/.+/, async (ctx, next) => {
            try {
                throttleActionsToShowHelpForNewComers(ctx)
            } finally {
                await next()
            }
        })
}

function prepareSessionStateIfNeeded(ctx: ContextMessageUpdate) {
    if (ctx.session.help === undefined) {
        ctx.session.help = {
            lastTimeShow: 0,
            cnt: 0
        }
    }
}

const MIN_INTERVAL_BETWEEN_HELPS_SECONDS = 60 * 5
const IDLE_TO_SHOW_HELP_SECONDS = 30
const CLICKS_TO_BE_MASTER = 10
const MIN_CLICKS_BEFORE_SHOW_HELP = 3

function throttleActionsToShowHelpForNewComers(ctx: ContextMessageUpdate) {
    const countInteractionsBefore = countInteractions(ctx)

    if (countInteractionsBefore >= MIN_CLICKS_BEFORE_SHOW_HELP && countInteractionsBefore <= CLICKS_TO_BE_MASTER) {
        prepareSessionStateIfNeeded(ctx)
        const promise = new Promise(resolve => setTimeout(resolve, IDLE_TO_SHOW_HELP_SECONDS * 1000))
        promise.then(async () => {

            const countInteractionsAfterMiddlewaresDone = countInteractions(ctx)
            if (countInteractionsAfterMiddlewaresDone == countInteractionsBefore) {
                const sessionKey = (redisSession as any).options.getSessionKey(ctx)
                const freshSession = await redisSession.getSession(sessionKey) as unknown as ContextMessageUpdate['session']
                ctx.session = freshSession

                if (freshSession && (countInteractions(ctx) == countInteractionsAfterMiddlewaresDone)) {

                    if (await newcomerIsIdle(ctx)) {
                        await redisSession.saveSession(sessionKey, ctx.session)
                    }
                }
            }
        })
    }
}

async function newcomerIsIdle(ctx: ContextMessageUpdate): Promise<boolean> {
    const secondsFromLastHelp = (new Date().getTime() - ctx.session.help.lastTimeShow) / 1000
    const MAX_COUNT_SHOW_HELP = 2
    if (ctx.session.help.cnt < MAX_COUNT_SHOW_HELP && secondsFromLastHelp > MIN_INTERVAL_BETWEEN_HELPS_SECONDS) {
        ctx.session.help.lastTimeShow = new Date().getTime()
        ctx.session.help.cnt++
        await ctx.replyWithHTML(i18Msg(ctx, 'newcomer_hint'), {disable_notification: true})
        return true
    }
    return false
}

export class HelpSceneState {
    lastTimeShow: number
    cnt: number
}

export const helpScene = {
    scene,
    postStageActionsFn,
    preSceneGlobalActionsFn
} as SceneRegister