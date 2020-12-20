import Telegraf, { Composer, Stage } from 'telegraf'
import { match } from 'telegraf-i18n';
import { mainScene } from './scenes/main/main-scene'
import { ContextMessageUpdate } from './interfaces/app-interfaces'
import middlewares, { myRegisterScene } from './middleware-utils'
import { timeTableScene } from './scenes/timetable/timetable-scene'
import { timeIntervalScene } from './scenes/time-interval/time-interval-scene'
import { isAdmin, sleep } from './util/scene-helper'
import 'source-map-support/register'
import { i18n } from './util/i18n'
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

logger.info(`starting bot...`);

const quick = botConfig.NODE_ENV === 'development'

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
bot.use(middlewares.telegrafThrottler)
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
    feedbackScene
])

// bot.catch(async (error: any, ctx: ContextMessageUpdate) => {
//     console.log(`Ooops, encountered an error for ${ctx.updateType}`, error)
//     await ctx.reply(ctx.i18n.t('shared.something_went_wrong_admin', { error: error.toString().substr(0, 1000) }))
// })

bot
    .start(async (ctx: ContextMessageUpdate & { startPayload: string }) => {
        console.log([
            `/start`,
            `id=${ctx.from.id}`,
            `first_name=${ctx.from.first_name}`,
            `last_name=${ctx.from.last_name}`,
            `username=${ctx.from.username}`,
            `startPayload=${ctx.startPayload}`,
            `ua_uuid=${ctx.session.uaUuid}`].join(' '))

        // cn Campaign Name
        // cs
        const name = ctx.message.from.first_name
        if (!quick) await sleep(500)
        await ctx.replyWithHTML(ctx.i18n.t('root.welcome1', {name: name}))
        if (!quick) await sleep(1000)
        await ctx.replyWithHTML(ctx.i18n.t('root.welcome2'), {disable_notification: true})
        if (!quick) await sleep(1000)
        await ctx.scene.enter('main_scene', {override_main_scene_msg: ctx.i18n.t('root.welcome3')});
        if (!quick) await sleep(1000)
        await ctx.replyWithHTML(ctx.i18n.t('root.welcome4'), {disable_notification: true})

        function getSourceTitle(sourceCode: string) {
            switch (sourceCode) {
                case 'i': return 'Instagram'
                case 'f': return 'Facebook'
                case 'v': return 'Вконтакте'
                case 'o': return 'Другое'
                default: return sourceCode
            }
        }

        if (ctx.startPayload !== '') {
            ctx.ua.set('cm', 'ny_2021')
            ctx.ua.set('cs', getSourceTitle(ctx.startPayload))
        }
        ctx.ua.pv({dp: `/start`, dt: `Старт`})
    })
    .command('menu', async (ctx: ContextMessageUpdate) => {
        await ctx.scene.enter('main_scene');
    })

    .command('error', async (ctx: ContextMessageUpdate) => {
        throw new Error('This is test error from userId=' + ctx.from.id)
    })

    .command('me', async (ctx: ContextMessageUpdate) => {
        if (isAdmin(ctx)) {
            await ctx.replyWithHTML(JSON.stringify(ctx.session, undefined, 2))
        }
    })
    .on('sticker', (ctx) => ctx.reply('👍'))
    .hears('hi', (ctx) => ctx.reply('Hey there'))
    .hears(/.+/, async (ctx) => {
        await ctx.replyWithHTML('Введена непонятная команда. Вернемся вначало? /menu')
    })

i18n.resourceKeys('ru')
    .filter((id: string) => id.match(/^(shared|scenes[.][^.]+)[.]keyboard[.](back)$/))
    .forEach((id: string) => {
        bot.hears(match(id), async (ctx) => {
            logger.debug('main catch: %s', id)
            await ctx.scene.enter('main_scene');
        });
    })


bot
    .action(/.+/, async (ctx) => {
        logger.debug('Аварийный выход');
        await ctx.answerCbQuery()
        await ctx.scene.enter('main_scene');
    })
    .hears(i18n.t(`ru`, `shared.keyboard.back`), async (ctx: ContextMessageUpdate) => {
        await ctx.scene.enter('main_scene');
    })
    .hears(/.+/, async (ctx, next) => {
        logger.info(`@${ctx.from.username} (id=${ctx.from.id}): [type=${ctx.updateType}], [text=${ctx.message.text}]`)

        return await next()
    })


rawBot.use(Composer.privateChat(bot))
rawBot.use(Composer.groupChat(middlewares.supportFeedbackMiddleware))