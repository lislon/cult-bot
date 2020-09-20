import Telegraf, { Stage } from 'telegraf'
import session from 'telegraf/session';
import logger from './util/logger';
import rp from 'request-promise';
import { match } from 'telegraf-i18n';
import { mainScene } from './scenes/main/main-scene'
import { ContextMessageUpdate } from './interfaces/app-interfaces'
import dbsync from './dbsync/dbsync'
import { db } from './db';
import middlewares from './bot-middleware-utils'
import { customizeScene } from './scenes/customize/customize-scene'
import { Scene, SceneContextMessageUpdate } from 'telegraf/typings/stage'
import { timeTableScene } from './scenes/timetable/timetable-scene'
import { timeIntervalScene } from './scenes/time-interval/time-interval-scene'
import { WrongExcelColumnsError } from './dbsync/WrongFormatException'

console.log(`starting bot...`);
db.any('select 1 + 1')

const bot: Telegraf<ContextMessageUpdate> = new Telegraf(process.env.TELEGRAM_TOKEN)
const stage = new Stage([])

bot.use(middlewares.rateLimit)
bot.use(middlewares.logger)
bot.use(session());
bot.use(middlewares.i18n);
bot.use(stage.middleware());


stage.register(mainScene, customizeScene, timeTableScene, timeIntervalScene)


bot.start(async (ctx: ContextMessageUpdate) => {
    console.log('bot.start')
    await ctx.scene.enter('main_scene');
});


bot.catch(async (error: any, ctx: ContextMessageUpdate) => {
    console.log(`Ooops, encountered an error for ${ctx.updateType}`, error)
    await ctx.reply(ctx.i18n.t('shared.something_went_wrong_dev', { error: error.toString().substr(0, 1000) }))
})


bot.command('/start', async (ctx: ContextMessageUpdate) => {
    await ctx.scene.enter('main_scene');
});


bot.start((ctx) => ctx.reply('Welcome!'))
bot.help((ctx) => ctx.reply('Send me a sticker'))
bot.on('sticker', (ctx) => ctx.reply('👍'))
bot.hears('hi', (ctx) => ctx.reply('Hey there'))

bot.hears(match('keyboards.back_keyboard.back'), async (ctx) => {
    console.log('keyboards.back_keyboard.back')
    await ctx.scene.enter('main_scene');
});
// bot.command('back', async (ctx) => {
//     console.log('bot.command(\'back\',')
//     await ctx.scene.enter('main_scene');
// });
//
// bot.action('back', async (ctx) => {
//     console.log('bot.command(\'back\',')
//     await ctx.scene.enter('main_scene');
// })

bot.action(/.+[.]back$/, async (ctx, next) => {
    console.log('Аварийный выход');
    await ctx.scene.enter('main_scene');
})

bot.command('sync', async (ctx) => {
    await ctx.replyWithHTML(`Пошла скачивать <a href="${getGoogleSpreadSheetURL()}">эксельчик</a>...`)
    try {
        const { updated, errors }  = await dbsync()
        await ctx.replyWithHTML(ctx.i18n.t('sync.sync_success', { updated, errors }))
    }
    catch (e) {
        if (e instanceof WrongExcelColumnsError) {
            await ctx.reply(ctx.i18n.t('sync.wrong_format', e.data))
        } else {
            await ctx.reply(`❌ Эх, что-то не удалось :(...` + e.toString().substr(0, 100))
        }
    }
})

bot.hears(/.+/, (ctx, next) => {
    console.debug(`@${ctx.from.username}: [type=${ctx.updateType}], [text=${ctx.message.text}]`)
    return next()
})

process.env.NODE_ENV === 'production' ? startProdMode(bot) : startDevMode(bot);

function getGoogleSpreadSheetURL() {
    return `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_DOCS_ID}`
}

function printDiagnostic() {
    logger.debug(undefined, `google docs db: ${getGoogleSpreadSheetURL()}` );
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
    const success = await bot.telegram.setWebhook(
        `https://${process.env.HEROKU_APP_NAME}.herokuapp.com:${process.env.WEBHOOK_PORT}/${process.env.TELEGRAM_TOKEN}`
    )
    if (success) {
        console.log(`hook is set. (To delete: https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/deleteWebhook ) Starting app at ${process.env.PORT}`)
    } else {
        console.error(`hook was not set!`)
        const webhookStatus = await bot.telegram.getWebhookInfo();
        console.log('Webhook status', webhookStatus);
        process.exit(2)
    }

    await bot.startWebhook(`/${process.env.TELEGRAM_TOKEN}`, undefined, +process.env.PORT);

    const webhookStatus = await bot.telegram.getWebhookInfo();


    console.log('Webhook status', webhookStatus);
    // checkUnreleasedMovies();
}
