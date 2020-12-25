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


bot.use(performanceMiddleware('total'))
bot.use(middlewares.i18n)
bot.use(middlewares.telegrafThrottler())
bot.use(middlewares.logger)
bot.use(middlewares.session)
bot.use(middlewares.logMiddleware('session'))
bot.use(middlewares.userSaveMiddleware)
bot.use(middlewares.dateTime)
bot.use(middlewares.analyticsMiddleware)
bot.use(middlewares.logMiddleware('analyticsMiddleware'))
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
    tailScene
])

rawBot.use(Composer.privateChat(bot))
rawBot.use(Composer.groupChat(middlewares.supportFeedbackMiddleware))