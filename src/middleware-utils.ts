import updateLogger from 'telegraf-update-logger'
import telegrafThrottler from 'telegraf-throttler';
import { ContextMessageUpdate } from './interfaces/app-interfaces'
import { isAdmin } from './util/scene-helper'
import { parseISO } from 'date-fns'
import { userSaveMiddleware } from './lib/middleware/user-save-middleware'
import { analyticsMiddleware } from './lib/middleware/analytics-middleware'
import { Composer, session, Stage } from 'telegraf'
import { Scene, SceneContextMessageUpdate } from 'telegraf/typings/stage'
import { supportFeedbackMiddleware } from './lib/middleware/support-feedback.middleware'
import { logger } from './util/logger'
import { i18n } from './util/i18n'
import { redisSession } from './util/reddis'
import { botConfig } from './util/bot-config'

let sessionMechanism
if (botConfig.REDIS_URL !== undefined && botConfig.NODE_ENV !== 'test') {
    sessionMechanism = redisSession
} else {
    sessionMechanism = session()
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


function logMiddleware(str: string) {
    return (ctx: ContextMessageUpdate, next: any) => {
        logger.silly(`before ${str}  (uauuId=${ctx.session?.uaUuid})`)
        return Promise.resolve(next()).then(() => {
            logger.silly(`after ${str} (uauuId=${ctx.session?.uaUuid})`)
        })
    }
}

export default {
    i18n: i18n.middleware(),
    dateTime: dateTimeMiddleware,
    telegrafThrottler: telegrafThrottler({
        onThrottlerError: async (ctx: ContextMessageUpdate, next, throttlerName, error) => {
            if (error.message === 'This job has been dropped by Bottleneck') {
                logger.debug(`Throttle limit ${throttlerName}: ${error} for user ${ctx.from.username}`)
            } else if (error.message.includes('query is too old and response timeout expired')) {
                logger.debug(error.message)
                // ignore
            } else {
                logger.error(`Ooops, encountered an error for ${ctx.updateType}`, error)
                if (isAdmin(ctx)) {
                    await ctx.replyWithHTML(ctx.i18n.t('root.something_went_wrong_admin', {
                        error: error.toString().substr(0, 4000),
                        time: (new Date()).toString(),
                        session: JSON.stringify(ctx.session, undefined, 2)
                    }))
                } else {
                    await ctx.replyWithHTML(ctx.i18n.t('root.something_went_wrong'))
                }
            }
            // console.log(throttlerName, error)
        }
    }),
    logger: updateLogger({colors: true}),
    session: sessionMechanism,
    logMiddleware: logMiddleware,
    userSaveMiddleware,
    analyticsMiddleware,
    supportFeedbackMiddleware
}

export type SceneGlobalActionsFn = (bot: Composer<ContextMessageUpdate>) => void

export interface SceneRegister {
    scene: Scene<ContextMessageUpdate>
    globalActionsFn: SceneGlobalActionsFn
    preSceneGlobalActionsFn?: SceneGlobalActionsFn
}

export const myRegisterScene = (bot: Composer<ContextMessageUpdate>,
                                stage: Stage<SceneContextMessageUpdate>,
                                scenesReg: SceneRegister[]) => {
    scenesReg.map(scene => {
        if (scene.preSceneGlobalActionsFn) {
            scene.preSceneGlobalActionsFn(bot)
        }
    })
    bot.use(logMiddleware('beforeStage'))
    bot.use(stage.middleware())
    scenesReg.map(scene => {
        stage.register(scene.scene)
        // all middlewares registered inside scene.globalActionsFn will have correct ctx.i18nScene
        // This is needed for ctx.i18nMsg functions
        scene.globalActionsFn(bot)
    })
    return stage
}