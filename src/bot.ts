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
import { packsScene } from './scenes/packs/packs-scene'
import { feedbackScene } from './scenes/feedback/feedback-scene'
import { logger } from './util/logger'

logger.info(`starting bot...`);

const quick = botConfig.NODE_ENV === 'development';

export const rawBot: Telegraf<ContextMessageUpdate> = new Telegraf(botConfig.TELEGRAM_TOKEN)
export const bot = new Composer<ContextMessageUpdate>()

const stage = new Stage([], {
    default: 'main_scene'
})


bot.use(performanceMiddleware('total'));
bot.use(middlewares.i18n);
bot.use(middlewares.telegrafThrottler)
bot.use(middlewares.logger)
bot.use(middlewares.session);
bot.use(middlewares.userSaveMiddleware);
bot.use(middlewares.dateTime);
bot.use(middlewares.analyticsMiddleware);
bot.use(stage.middleware());


myRegisterScene(bot, stage, [mainScene, customizeScene, timeTableScene, timeIntervalScene, adminScene, packsScene, searchScene, feedbackScene])

// bot.catch(async (error: any, ctx: ContextMessageUpdate) => {
//     console.log(`Ooops, encountered an error for ${ctx.updateType}`, error)
//     await ctx.reply(ctx.i18n.t('shared.something_went_wrong_dev', { error: error.toString().substr(0, 1000) }))
// })

bot.start(async (ctx: ContextMessageUpdate & { startPayload: string }) => {
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
    await ctx.replyWithHTML(ctx.i18n.t('shared.welcome1', {name: name}))
    if (!quick) await sleep(1000)
    await ctx.replyWithHTML(ctx.i18n.t('shared.welcome2'), {disable_notification: true})
    if (!quick) await sleep(1000)
    await ctx.replyWithHTML(ctx.i18n.t('shared.welcome3'), {disable_notification: true})
    if (!quick) await sleep(1000)
    await ctx.replyWithHTML(ctx.i18n.t('shared.welcome4'), {disable_notification: true})
    await sleep(1000)
    await ctx.scene.enter('main_scene');
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
    .start((ctx) => ctx.reply('Welcome!'))
    .help((ctx) => ctx.reply('Send me a sticker'))
    .on('sticker', (ctx) => ctx.reply('👍'))
    .hears('hi', (ctx) => ctx.reply('Hey there'))

i18n.resourceKeys('ru')
    .filter((id: string) => id.match(/^(shared|scenes[.][^.]+)[.]keyboard[.](back|go_back_to_main)$/))
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


bot.hears(/.+/, async (ctx, next) => {
    logger.info(`@${ctx.from.username} (id=${ctx.from.id}): [type=${ctx.updateType}], [text=${ctx.message.text}]`)

    return await next()
})


rawBot.use(Composer.privateChat(bot))
rawBot.use(Composer.groupChat(middlewares.supportFeedbackMiddleware))