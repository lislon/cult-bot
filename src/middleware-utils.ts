import updateLogger from 'telegraf-update-logger'
import telegrafThrottler from 'telegraf-throttler'
import { ContextMessageUpdate } from './interfaces/app-interfaces'
import { parseISO } from 'date-fns'
import { userMiddleware } from './lib/middleware/user-middleware'
import { analyticsMiddleware } from './lib/middleware/analytics-middleware'
import { Composer, session, Stage } from 'telegraf'
import { Scene, SceneContextMessageUpdate } from 'telegraf/typings/stage'
import { supportFeedbackMiddleware } from './lib/middleware/support-feedback.middleware'
import { logger } from './util/logger'
import { i18n } from './util/i18n'
import { MyRedisSession, redisSession } from './util/reddis'
import { botConfig } from './util/bot-config'

let sessionMechanism: MyRedisSession

if (botConfig.REDIS_URL !== undefined && botConfig.NODE_ENV !== 'test') {
    sessionMechanism = redisSession
} else {
    sessionMechanism = session() as any
}

export async function saveSession(ctx: ContextMessageUpdate) {
    const key = sessionMechanism.options.getSessionKey(ctx)
    await sessionMechanism.saveSession(key, ctx.session)
    logger.warn('Emergency saving session')
}

const dateTimeMiddleware = async (ctx: ContextMessageUpdate, next: any) => {
    ctx.isNowOverridden = () => ctx.session.adminScene !== undefined && ctx.session.adminScene.overrideDate !== undefined
    ctx.now = () => {
        if (ctx.isNowOverridden()) {
            return parseISO(ctx.session.adminScene.overrideDate)
        } else {
            return new Date()
        }
    }

    return await next()
}


function sessionTmp() {
    return async (ctx: ContextMessageUpdate, next: any) => {
        ctx.sessionTmp = {
            analyticsScene: undefined
        }
        await next()
    }

}

function logMiddleware(str: string) {
    return (ctx: ContextMessageUpdate, next: any) => {
        logger.silly(`before ${str}  (uauuId=${ctx.session?.user?.uaUuid})`)
        return Promise.resolve(next()).then(() => {
            logger.silly(`after ${str} (uauuId=${ctx.session?.user?.uaUuid})`)
        })
    }
}

export default {
    i18n: i18n.middleware(),
    dateTime: dateTimeMiddleware,
    telegrafThrottler: (opts?: Parameters<typeof telegrafThrottler>[0]) => {
        return telegrafThrottler({
            onThrottlerError: async (ctx: ContextMessageUpdate, next, throttlerName, error: any) => {
                logger.debug(`Throttle limit ${throttlerName}: ${error} for user ${ctx.from.username}`)
            },
            ...opts,
        })
    },
    logger: updateLogger({colors: true}),
    session: sessionMechanism,
    sessionTmp: sessionTmp(),
    logMiddleware: logMiddleware,
    userMiddleware: userMiddleware,
    analyticsMiddleware,
    supportFeedbackMiddleware
}

export type SceneGlobalActionsFn = (bot: Composer<ContextMessageUpdate>) => void

export interface SceneRegister {
    scene?: Scene<ContextMessageUpdate>
    postStageActionsFn: SceneGlobalActionsFn
    preStageGlobalActionsFn?: SceneGlobalActionsFn
    preSceneGlobalActionsFn?: SceneGlobalActionsFn
}

export const myRegisterScene = (bot: Composer<ContextMessageUpdate>,
                                stage: Stage<SceneContextMessageUpdate>,
                                scenesReg: SceneRegister[]) => {
    scenesReg.map(scene => {
        scene.preSceneGlobalActionsFn?.(bot)
    })
    // bot.use(logMiddleware('stage.middleware()'))
    bot.use(stage.middleware())
    scenesReg.map(scene => {
        scene.preStageGlobalActionsFn?.(bot)

        if (scene.scene !== undefined) {
            stage.register(scene.scene)
        }
        // all middlewares registered inside scene.postStageActionsFn will have correct ctx.i18nScene
        // This is needed for ctx.i18nMsg functions
        scene.postStageActionsFn?.(bot)
    })
    return stage
}