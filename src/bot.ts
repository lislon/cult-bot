import Telegraf, { Composer, Stage } from 'telegraf'
import { mainScene } from './scenes/main/main-scene'
import { ContextMessageUpdate } from './interfaces/app-interfaces'
import middlewares, { myRegisterScene } from './middleware-utils'
import { timeTableScene } from './scenes/timetable/timetable-scene'
import { timeIntervalScene } from './scenes/time-interval/time-interval-scene'
import 'source-map-support/register'
import { performanceMiddleware } from './lib/middleware/performance-middleware'
import { botConfig } from './util/bot-config'
import { customizeScene } from './scenes/customize/customize-scene'
import { adminScene } from './scenes/admin/admin-scene'
import { searchScene } from './scenes/search/search-scene'
import { topsScene } from './scenes/tops/tops-scene'
import { feedbackScene } from './scenes/feedback/feedback-scene'
import { logger } from './util/logger'
import { helpScene } from './scenes/help/help-scene'
import { packsScene } from './scenes/packs/packs-scene'
import { tailScene } from './scenes/tail/tail-scene'
import { filterOnlyFeedbackChat } from './lib/middleware/support-feedback.middleware'
import { botErrorHandler } from './util/error-handler'
import { likesScene } from './scenes/likes/likes-scene'

logger.info(`starting bot...`);


export const rawBot: Telegraf<ContextMessageUpdate> = new Telegraf(botConfig.TELEGRAM_TOKEN, {
    telegram: {
        // feedback scene requires this, because otherwise it cannot obtain id message sent to admin feedback chat
        // https://core.telegram.org/bots/faq#how-can-i-make-requests-in-response-to-updates
        webhookReply: false
    }
})
export const bot = new Composer<ContextMessageUpdate>()

const stage = new Stage([], {
    default: 'main_scene'
})


bot
    .use(performanceMiddleware('total'))
    .use(middlewares.i18n)
    .use(middlewares.telegrafThrottler())
    .use(middlewares.logger)
    .use(middlewares.session)
    // .use(middlewares.logMiddleware('session'))
    .use(middlewares.userSaveMiddleware)
    .use(middlewares.dateTime)
    .use(middlewares.analyticsMiddleware)
// .use(middlewares.logMiddleware('analyticsMiddleware'))

myRegisterScene(bot, stage, [
    mainScene,
    helpScene,
    customizeScene,
    packsScene,
    timeTableScene,
    timeIntervalScene,
    adminScene,
    topsScene,
    searchScene,
    feedbackScene,
    likesScene,
    tailScene
])



const supportChat = new Composer<ContextMessageUpdate>()
    .use(filterOnlyFeedbackChat)
    .use(middlewares.i18n)
    .use(middlewares.telegrafThrottler())
    .use(middlewares.logger)
    .use(middlewares.session)
    // .use(middlewares.logMiddleware('session'))
    .use(middlewares.supportFeedbackMiddleware)

rawBot
    .use(Composer.privateChat(bot))
    .use(Composer.groupChat(supportChat))
    .catch(botErrorHandler)