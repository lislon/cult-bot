import { Scenes, Telegraf } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { i18nSceneHelper } from '../../util/scene-helper'
import middlewares, { SceneRegister } from '../../middleware-utils'
import { createReadStream, ReadStream } from 'fs'
import path from 'path'
import { getRedisSession } from '../../util/reddis'
import { countInteractions } from '../../lib/middleware/analytics-middleware'
import { botErrorHandler, isBlockedError } from '../../util/error-handler'
import { updateOrInsertUser } from '../../lib/middleware/user-middleware'

const scene = new Scenes.BaseScene<ContextMessageUpdate>('help_scene')
const {i18Msg} = i18nSceneHelper(scene)

let cached_help_file_id = ''

function postStageActionsFn(bot: Telegraf<ContextMessageUpdate>): void {
    bot
        .use(middlewares.logMiddleware('postStageActionsFn scene: ' + scene.id))
        .help(async (ctx: ContextMessageUpdate) => {
            ctx.ua.pv({dp: '/help', dt: 'Помощь'})

            let photo: string | { source: ReadStream }
            if (cached_help_file_id === '') {
                photo = {source: createReadStream(path.resolve(__dirname, './assets/help.png'))}
            } else {
                photo = cached_help_file_id
            }
            try {
                const result = await ctx.replyWithPhoto(photo, {
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
        .command('reset', async ctx => {
            ctx.session.help = undefined
            if (ctx.session.analytics) {
                ctx.session.analytics.markupClicks = 0
                ctx.session.analytics.inlineClicks = 0
            }
            await ctx.replyWithHTML(i18Msg(ctx, 'reset'))
        })
}

function preSceneGlobalActionsFn(bot: Telegraf<ContextMessageUpdate>): void {
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
                const sessionKey = getRedisSession().options.getSessionKey(ctx)
                const freshSession = await getRedisSession().getSession(sessionKey) as unknown as ContextMessageUpdate['session']
                ctx.session = freshSession

                if (freshSession && (countInteractions(ctx) == countInteractionsAfterMiddlewaresDone)) {

                    try {
                        if (await newcomerIsIdle(ctx)) {
                            await getRedisSession().saveSession(sessionKey, ctx.session)
                        }
                    } catch (e) {
                        await botErrorHandler(e, ctx)
                        if (isBlockedError(e)) {
                            await updateOrInsertUser(ctx, new Date())
                        }
                    }
                }
            }
        })
    }
}

async function newcomerIsIdle(ctx: ContextMessageUpdate): Promise<boolean> {
    if (!ctx.session.help) return false
    const secondsFromLastHelp = (new Date().getTime() - ctx.session.help.lastTimeShow) / 1000
    const MAX_COUNT_SHOW_HELP = 2
    if (ctx.session.help.cnt < MAX_COUNT_SHOW_HELP && secondsFromLastHelp > MIN_INTERVAL_BETWEEN_HELPS_SECONDS) {
        ctx.session.help.lastTimeShow = new Date().getTime()
        ctx.session.help.cnt++
        ctx.logger.info('Displaying /help')
        await ctx.replyWithHTML(i18Msg(ctx, 'newcomer_hint'), {disable_notification: true})
        return true
    }
    return false
}

export class HelpSceneState {
    lastTimeShow: number
    cnt: number
}

export const helpScene: SceneRegister = {
    scene,
    postStageActionsFn,
    preSceneGlobalActionsFn
}