import updateLogger from 'telegraf-update-logger'
import session from 'telegraf/session';
import telegrafThrottler from 'telegraf-throttler';
import RedisSession from 'telegraf-session-redis'
import { ContextMessageUpdate } from './interfaces/app-interfaces'
import { isDev } from './util/scene-helper'
import { parseISO } from 'date-fns'
import { userSaveMiddleware } from './lib/middleware/user-save-middleware'
import { botConfig } from './util/bot-config'
import { analyticsMiddleware } from './lib/middleware/analytics-middleware'
import { Composer, Stage } from 'telegraf'
import { Scene, SceneContextMessageUpdate } from 'telegraf/typings/stage'
import { supportFeedbackMiddleware } from './lib/middleware/support-feedback.middleware'
import { logger } from './util/logger'
import { i18n } from './util/i18n'

let sessionMechanism
if (botConfig.REDIS_URL !== undefined && botConfig.NODE_ENV !== 'test') {
    sessionMechanism = new RedisSession({
        store: {
            host: undefined,
            port: undefined,
            url: botConfig.REDIS_URL
        }
    })
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
        console.log(`before ${str}  (uauuId=${ctx.session?.uaUuid})`)
        return Promise.resolve(next()).then(() => {
            console.log(`after ${str} (uauuId=${ctx.session?.uaUuid})`)
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
            } else {
                logger.error(`Ooops, encountered an error for ${ctx.updateType}`, error)
                if (isDev(ctx)) {
                    await ctx.replyWithHTML(ctx.i18n.t('shared.something_went_wrong_dev', {
                        error: error.toString().substr(0, 1000),
                        time: (new Date()).toString(),
                        session: JSON.stringify(ctx.session, undefined, 2)
                    }))
                } else {
                    await ctx.replyWithHTML(ctx.i18n.t('shared.something_went_wrong'))
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
}

export const myRegisterScene = (bot: Composer<ContextMessageUpdate>,
                                stage: Stage<SceneContextMessageUpdate>,
                                scenesReg: SceneRegister[]) => {
    scenesReg.map(scene => {
        stage.register(scene.scene)
        // all middlewares registered inside scene.globalActionsFn will have correct ctx.i18nScene
        // This is needed for ctx.i18nMsg functions
        scene.globalActionsFn(bot)
    })
    return stage
}