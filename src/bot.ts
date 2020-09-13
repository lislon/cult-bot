import Telegraf, { Stage } from 'telegraf'
import session from 'telegraf/session';
import logger from './util/logger';
import asyncWrapper from './util/error-handler'
import { getMainKeyboard } from './util/keyboards';
import { match } from 'telegraf-i18n';
import rp from 'request-promise';
import listScenes from './scenes/list/list-scene'
import { allCategories, ContextMessageUpdate } from './interfaces/app-interfaces'
import dbsync from './dbsync/dbsync'
import { db } from './db';
import middlewares from './bot-middleware-utils'
import { customizeScene } from './scenes/customize/customize-scene'
import { Scene, SceneContextMessageUpdate } from 'telegraf/typings/stage'
import { timetableScene } from './scenes/timetable/timetable-scene'
import { timeIntervalScene } from './scenes/time-interval/time-interval-scene'

console.log(`starting bot...`);
db.any('select 1 + 1')

const bot: Telegraf<ContextMessageUpdate> = new Telegraf(process.env.TELEGRAM_TOKEN)
const stage = new Stage([])

function registerListStage() {
    stage.register(...listScenes)
    for (const cat of allCategories) {
        bot.action(cat, asyncWrapper(async (ctx: ContextMessageUpdate) => await ctx.scene.enter(cat)));
    }
}

function registerSimpleScene<TContext extends SceneContextMessageUpdate>(...scenes: Scene<TContext>[]) {
    stage.register(customizeScene, timetableScene, timeIntervalScene)
    bot.action('customize', async (ctx: ContextMessageUpdate) => await ctx.scene.enter('customize'))
}


bot.use(middlewares.rateLimit)
bot.use(middlewares.logger)
bot.use(session());
bot.use(middlewares.i18n);
bot.use(stage.middleware());


registerListStage()
registerSimpleScene()

bot.catch(async (error: any, ctx: ContextMessageUpdate) => {
    console.log(`Ooops, encountered an error for ${ctx.updateType}`, error)
    await ctx.reply(ctx.i18n.t('shared.something_went_wrong_dev', { error: error.toString().substr(0, 300) }))
})

bot.start(asyncWrapper(async (ctx: ContextMessageUpdate) => {
    const {mainKeyboard} = getMainKeyboard(ctx);
    await ctx.reply(ctx.i18n.t('shared.what_next'), mainKeyboard)
}));

bot.command('/saveme', async (ctx: ContextMessageUpdate) => {
    logger.debug(ctx, 'User uses /saveme command');

    const {mainKeyboard} = getMainKeyboard(ctx);

    await ctx.reply(ctx.i18n.t('shared.what_next'), mainKeyboard);
});


bot.start((ctx) => ctx.reply('Welcome!'))
bot.help((ctx) => ctx.reply('Send me a sticker'))
bot.on('sticker', (ctx) => ctx.reply('👍'))
bot.hears('hi', (ctx) => ctx.reply('Hey there'))
bot.hears(match('keyboards.back_keyboard.back'), async (ctx) => {
    const {mainKeyboard} = getMainKeyboard(ctx);
    await ctx.reply(ctx.i18n.t('shared.what_next'), mainKeyboard);
});
bot.command('back', async (ctx) => {
    const {mainKeyboard} = getMainKeyboard(ctx);
    await ctx.reply(ctx.i18n.t('shared.what_next'), mainKeyboard);
});

bot.command('sync', async (ctx) => {
    await ctx.reply('Пошла скачивать эксельчик...')
    try {
        const { updated, errors }  = await dbsync()
        await ctx.reply(`✅ База обновлена. Всего загужено ${updated} событий. У ${errors} событий ошибки.`)
    } catch (e) {
        await ctx.reply(`❌ Эх, что-то не удалось :(...` + e.toString().substr(0, 100))
    }
})

bot.action('back', async (ctx) => {
    const {mainKeyboard} = getMainKeyboard(ctx);
    await ctx.reply(ctx.i18n.t('shared.what_next'), mainKeyboard);
})

bot.hears(/.+/, (ctx, next) => {
    console.debug(`@${ctx.from.username}: [type=${ctx.updateType}], [text=${ctx.message.text}]`)
})
bot.action(/.+[.]back$/, async (ctx, next) => {
    console.log('Аварийный выход');
    const {mainKeyboard} = getMainKeyboard(ctx);
    await ctx.reply(ctx.i18n.t('shared.what_next'), mainKeyboard);
})

process.env.NODE_ENV === 'production' ? startProdMode(bot) : startDevMode(bot);

function printDiagnostic() {
    logger.debug(undefined, `google docs db: https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_DOCS_ID}` );
}

function startDevMode(bot: Telegraf<ContextMessageUpdate>) {
    logger.debug(undefined, 'Starting a bot in development mode');
    printDiagnostic()

    rp(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/deleteWebhook`).then(() => {
        console.log(`Bot started`)
        bot.startPolling()
    });
}

async function startProdMode(bot: Telegraf<ContextMessageUpdate>) {
    logger.debug(undefined, 'Starting a bot in production mode');
    // If webhook not working, check fucking motherfucking UFW that probably blocks a port...
    printDiagnostic()
    // const tlsOptions = {
    //     key: fs.readFileSync(process.env.PATH_TO_KEY),
    //     cert: fs.readFileSync(process.env.PATH_TO_CERT)
    // };

    if (!process.env.HEROKU_APP_NAME) {
        console.log('process.env.HEROKU_APP_NAME must be defined to run in PROD')
        process.exit(1)
    }
    if (!process.env.WEBHOOK_PORT) {
        console.log('process.env.WEBHOOK_PORT must be defined to run in PROD')
        process.exit(1)
    }
    await bot.telegram.setWebhook(
        `https://${process.env.HEROKU_APP_NAME}.herokuapp.com:${process.env.WEBHOOK_PORT}/${process.env.TELEGRAM_TOKEN}`
    );

    console.log(`hook is set. To delete: https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/deleteWebhook`)

    await bot.startWebhook(`/${process.env.TELEGRAM_TOKEN}`, undefined, +process.env.PORT);

    const webhookStatus = await bot.telegram.getWebhookInfo();
    console.log('Webhook status', webhookStatus);


    // checkUnreleasedMovies();
}
