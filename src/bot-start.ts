import Telegraf, { Stage } from 'telegraf'
import logger from './util/logger';
import rp from 'request-promise';
import { match } from 'telegraf-i18n';
import { mainRegisterActions, mainScene } from './scenes/main/main-scene'
import { adminRegisterActions, adminScene } from './scenes/admin/admin-scene'
import { ContextMessageUpdate } from './interfaces/app-interfaces'
import { db } from './db';
import middlewares, { i18n } from './middleware-utils'
import { customizeRegisterActions, customizeScene } from './scenes/customize/customize-scene'
import { timeTableScene } from './scenes/timetable/timetable-scene'
import { timeIntervalScene } from './scenes/time-interval/time-interval-scene'
import { sleep } from './util/scene-helper'
import 'source-map-support/register'
import moment from 'moment'
import { getGoogleSpreadSheetURL, syncrhonizeDbByUser } from './scenes/shared/shared-logic'

console.log(`starting bot...`);
db.any('select 1 + 1')

const quick = process.env.NODE_ENV === 'development';

const bot: Telegraf<ContextMessageUpdate> = new Telegraf(process.env.TELEGRAM_TOKEN)
const stage = new Stage([], {
    default: 'main_scene'
})

bot.use(middlewares.i18n);
bot.use(middlewares.telegrafThrottler)
bot.use(middlewares.logger)
bot.use(middlewares.session);
bot.use(stage.middleware());

stage.register(mainScene, customizeScene, timeTableScene, timeIntervalScene, adminScene)
mainRegisterActions(bot, i18n)
customizeRegisterActions(bot, i18n)
adminRegisterActions(bot, i18n)

// bot.catch(async (error: any, ctx: ContextMessageUpdate) => {
//     console.log(`Ooops, encountered an error for ${ctx.updateType}`, error)
//     await ctx.reply(ctx.i18n.t('shared.something_went_wrong_dev', { error: error.toString().substr(0, 1000) }))
// })

bot.start(async (ctx: ContextMessageUpdate) => {
    console.log('bot.start')
    const name = ctx.message.from.first_name
    if (!quick) await sleep(500)
    await ctx.replyWithHTML(ctx.i18n.t('shared.welcome1', { name: name }))
    if (!quick) await sleep(1800)
    await ctx.replyWithHTML(ctx.i18n.t('shared.welcome2'), { disable_notification: true })
    if (!quick) await sleep(4000)
    await ctx.replyWithHTML(ctx.i18n.t('shared.welcome3'), { disable_notification: true })
    if (!quick) await sleep(5000)
    await ctx.replyWithHTML(ctx.i18n.t('shared.welcome4'), { disable_notification: true })
    await sleep(2000)
    await ctx.scene.enter('main_scene');
});



bot.command('menu', async (ctx: ContextMessageUpdate) => {
    await ctx.scene.enter('main_scene');
});

bot.start((ctx) => ctx.reply('Welcome!'))
bot.help((ctx) => ctx.reply('Send me a sticker'))
bot.on('sticker', (ctx) => ctx.reply('👍'))
bot.hears('hi', (ctx) => ctx.reply('Hey there'))

i18n.resourceKeys('ru')
    .filter(id => id.match(/^(shared|scenes[.][^.]+)[.]keyboard[.].*back/))
    .forEach(id => {
        bot.hears(match(id), async (ctx) => {
            console.log('main catch', id)
            await ctx.scene.enter('main_scene');
        });
    })



// bot.command('back', async (ctx) => {
//     console.log('bot.command(\'back\',')
//     await ctx.scene.enter('main_scene');
// });
//
// bot.action('back', async (ctx) => {
//     console.log('bot.command(\'back\',')
//     await ctx.scene.enter('main_scene');
// })

// bot.action(/.+[.]back$/, async (ctx, next) => {
//     console.log('Аварийный выход');
//     await ctx.scene.enter('main_scene');
// })

bot.action(/.+/, async (ctx, next) => {
    console.log('Аварийный выход');
    await ctx.scene.enter('main_scene');
})


bot.command('version', async (ctx) => {
    const info = [
        ['Release', process.env.HEROKU_RELEASE_VERSION],
        ['Commit', process.env.HEROKU_SLUG_COMMIT],
        ['Date', `${process.env.HEROKU_RELEASE_CREATED_AT} (${moment(process.env.HEROKU_RELEASE_CREATED_AT).fromNow()})`],
    ]
    await ctx.replyWithHTML(info.map(row => `<b>${row[0]}</b>: ${row[1]}`).join('\n'))
})

bot.command('sync', async (ctx) => {
    await syncrhonizeDbByUser(ctx)
})

bot.hears(/.+/, (ctx, next) => {
    console.debug(`@${ctx.from.username}: [type=${ctx.updateType}], [text=${ctx.message.text}]`)
    return next()
})

process.env.NODE_ENV === 'production' ? startProdMode(bot) : startDevMode(bot);

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


// bot.command('pyramid', (ctx) => {
//     return ctx.reply('Keyboard wrap', Extra.markup(
//         Markup.keyboard(['one', 'two', 'three', 'four', 'five', 'six'], {
//             wrap: (btn, index, currentRow) => currentRow.length >= (index + 1) / 2
//         })
//     ))
// })
//
// bot.command('simple', (ctx) => {
//     return ctx.replyWithHTML('<b>Coke</b> or <i>Pepsi?</i>', Extra.markup(
//         Markup.keyboard(['Coke', 'Pepsi'])
//     ))
// })
//
// bot.command('inline', (ctx) => {
//     return ctx.reply('<b>Coke</b> or <i>Pepsi?</i>', Extra.HTML().markup((m) =>
//         m.inlineKeyboard([
//             m.callbackButton('Coke', 'Coke'),
//             m.callbackButton('Pepsi', 'Pepsi')
//         ])))
// })
//
// bot.command('random', (ctx) => {
//     return ctx.reply('random example',
//         Markup.inlineKeyboard([
//             Markup.callbackButton('Coke', 'Coke'),
//             Markup.callbackButton('Dr Pepper', 'Dr Pepper', Math.random() > 0.5),
//             Markup.callbackButton('Pepsi', 'Pepsi')
//         ]).extra()
//     )
// })
//
// bot.command('caption', (ctx) => {
//     return ctx.replyWithPhoto({ url: 'https://picsum.photos/200/300/?random' },
//         Extra.load({ caption: 'Caption' })
//             .markdown()
//             .markup((m) =>
//                 m.inlineKeyboard([
//                     m.callbackButton('Plain', 'plain'),
//                     m.callbackButton('Italic', 'italic')
//                 ])
//             )
//     )
// })
//
// bot.hears(/\/wrap (\d+)/, (ctx) => {
//     return ctx.reply('Keyboard wrap', Extra.markup(
//         Markup.keyboard(['one', 'two', 'three', 'four', 'five', 'six'], {
//             columns: parseInt(ctx.match[1])
//         })
//     ))
// })
//
// bot.action(/.+/, (ctx) => {
//     return ctx.answerCbQuery(`Oh, ${ctx.match[0]}! Great choice 1`)
// })
//
// bot.action(/.+/, (ctx) => {
//     return ctx.answerCbQuery(`Oh, ${ctx.match[0]}! Great choice 2`)
// })
//
// bot.action('Dr Pepper', (ctx, next) => {
//     return ctx.reply('👍').then(() => next())
// })
//
// bot.action('plain', async (ctx) => {
//     await ctx.answerCbQuery()
//     await ctx.editMessageCaption('Caption', Markup.inlineKeyboard([
//         Markup.callbackButton('Plain', 'plain'),
//         Markup.callbackButton('Italic', 'italic')
//     ]))
// })
//
// bot.action('italic', async (ctx) => {
//     await ctx.answerCbQuery()
//     await ctx.editMessageCaption('_Caption_', Extra.markdown().markup(Markup.inlineKeyboard([
//         Markup.callbackButton('Plain', 'plain'),
//         Markup.callbackButton('* Italic *', 'italic')
//     ])))
// })
