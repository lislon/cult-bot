import telegrafThrottler, { ThrottlerOptions } from 'telegraf-throttler'
import { ContextMessageUpdate, MySession } from './interfaces/app-interfaces'
import { parseISO } from 'date-fns'
import { userMiddleware } from './lib/middleware/user-middleware'
import { analyticsMiddleware } from './lib/middleware/analytics-middleware'
import { supportFeedbackMiddleware } from './lib/middleware/support-feedback.middleware'
import { logger } from './util/logger'
import { i18n } from './util/i18n'
import { getRedisSession, MyRedisSession } from './util/reddis'
import { botConfig } from './util/bot-config'
import { formatUserName } from './util/misc-utils'
import { loggerMiddleware } from './lib/middleware/logger-middleware'
import { Composer, Scenes, session } from 'telegraf'
import { sentryMiddleware } from './lib/middleware/sentry-middleware'


let sessionMechanism: MyRedisSession = undefined

function getSessionMechism(): MyRedisSession {
    if (sessionMechanism === undefined) {
        if (botConfig.REDIS_URL !== undefined && botConfig.NODE_ENV !== 'test') {
            sessionMechanism = getRedisSession()
        } else {
            sessionMechanism = session() as any
        }
    }
    return sessionMechanism;
}

export async function saveSession(ctx: ContextMessageUpdate) {
    const key = getSessionMechism().options.getSessionKey(ctx)
    await getSessionMechism().saveSession(key, ctx.session)
    logger.warn('Emergency saving session')
}

const dateTimeMiddleware = async (ctx: ContextMessageUpdate, next: () => Promise<void>) => {
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
    return async (ctx: ContextMessageUpdate, next: () => Promise<void>) => {
        ctx.sessionTmp = {
            analyticsScene: undefined
        }
        if (ctx.session === undefined) {
            ctx.session = {
                __scenes: undefined
            } as MySession
        }
        await next()
    }

}

function logMiddleware(str: string) {
    return (ctx: ContextMessageUpdate, next: () => Promise<void>) => {
        logger.silly(`before ${str}  (uauuId=${ctx.session?.user?.uaUuid})`)
        return Promise.resolve(next()).then(() => {
            logger.silly(`after ${str} (uauuId=${ctx.session?.user?.uaUuid})`)
        })
    }
}

function loggerInjectMiddleware() {
    return (ctx: ContextMessageUpdate, next: () => Promise<void>) => {
        ctx.logger = logger.child({user: formatUserName(ctx)})
        return Promise.resolve(next())
    }
}

export default {
    i18n: i18n.middleware(),
    dateTime: dateTimeMiddleware,
    telegrafThrottler: (opts?: ThrottlerOptions) => {
        return telegrafThrottler({
            inThrottlerError: async (ctx: ContextMessageUpdate, next, error: Error) => {
                logger.debug(`Throttle limit: ${error} for user ${ctx.from.username}`)
            },
            ...opts,
        })
    },
    loggerInject: loggerInjectMiddleware(),
    logger: loggerMiddleware,
    session:  getSessionMechism,
    sessionTmp: sessionTmp,
    logMiddleware: logMiddleware,
    userMiddleware: userMiddleware,
    analyticsMiddleware,
    sentryMiddleware: sentryMiddleware,
    supportFeedbackMiddleware
}

export type SceneGlobalActionsFn = (bot: Composer<ContextMessageUpdate>) => void

export interface SceneRegister {
    scene?: Scenes.BaseScene<ContextMessageUpdate>
    postStageActionsFn?: SceneGlobalActionsFn
    preStageGlobalActionsFn?: SceneGlobalActionsFn
    preSceneGlobalActionsFn?: SceneGlobalActionsFn
}

export function myRegisterScene(bot: Composer<ContextMessageUpdate>,
                                stage: Scenes.Stage<ContextMessageUpdate>,
                                scenesReg: SceneRegister[]) {
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