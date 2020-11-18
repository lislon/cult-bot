import Telegraf, { Stage } from 'telegraf'
import { match } from 'telegraf-i18n';
import { mainRegisterActions, mainScene } from './scenes/main/main-scene'
import { adminRegisterActions, adminScene } from './scenes/admin/admin-scene'
import { packsRegisterActions, packsScene } from './scenes/packs/packs-scene'
import { ContextMessageUpdate } from './interfaces/app-interfaces'
import middlewares from './middleware-utils'
import { customizeRegisterActions, customizeScene } from './scenes/customize/customize-scene'
import { timeTableScene } from './scenes/timetable/timetable-scene'
import { timeIntervalScene } from './scenes/time-interval/time-interval-scene'
import { searchRegisterActions, searchScene } from './scenes/search/search-scene'
import { ifAdmin, isAdmin, sleep } from './util/scene-helper'
import 'source-map-support/register'
import { showBotVersion, syncrhonizeDbByUser } from './scenes/shared/shared-logic'
import { i18n } from './util/i18n'
import { performanceMiddleware } from './lib/middleware/performance-middleware'
import { botConfig } from './util/bot-config'

console.log(`starting bot...`);

const quick = botConfig.NODE_ENV === 'development';

export const bot: Telegraf<ContextMessageUpdate> = new Telegraf(botConfig.TELEGRAM_TOKEN)
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

stage.register(mainScene, customizeScene, timeTableScene, timeIntervalScene, adminScene, packsScene, searchScene)
mainRegisterActions(bot, i18n)
customizeRegisterActions(bot, i18n)
adminRegisterActions(bot, i18n)
packsRegisterActions(bot, i18n)
searchRegisterActions(bot, i18n)

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
    await ctx.replyWithHTML(ctx.i18n.t('shared.welcome1', { name: name }))
    if (!quick) await sleep(1000)
    await ctx.replyWithHTML(ctx.i18n.t('shared.welcome2'), { disable_notification: true })
    if (!quick) await sleep(1000)
    await ctx.replyWithHTML(ctx.i18n.t('shared.welcome3'), { disable_notification: true })
    if (!quick) await sleep(1000)
    await ctx.replyWithHTML(ctx.i18n.t('shared.welcome4'), { disable_notification: true })
    await sleep(1000)
    await ctx.scene.enter('main_scene');
});



bot.command('menu', async (ctx: ContextMessageUpdate) => {
    await ctx.scene.enter('main_scene');
});

bot.command('error', async (ctx: ContextMessageUpdate) => {
    throw new Error('This is test error from userId=' + ctx.from.id)
});

bot.command('me', async (ctx: ContextMessageUpdate) => {
    if (isAdmin(ctx)) {
        await ctx.replyWithHTML(JSON.stringify(ctx.session, undefined, 2))
    }
});

bot.start((ctx) => ctx.reply('Welcome!'))
bot.help((ctx) => ctx.reply('Send me a sticker'))
bot.on('sticker', (ctx) => ctx.reply('👍'))
bot.hears('hi', (ctx) => ctx.reply('Hey there'))

i18n.resourceKeys('ru')
    .filter((id: string) => id.match(/^(shared|scenes[.][^.]+)[.]keyboard[.].*back/))
    .forEach((id: string) => {
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

bot
    .action(/.+/, async (ctx, next) => {
    console.log('Аварийный выход');
    await ctx.answerCbQuery()
    await ctx.scene.enter('main_scene');
})
.hears(i18n.t(`ru`, `shared.keyboard.back`), async (ctx: ContextMessageUpdate) => {
    await ctx.scene.enter('main_scene');
})


bot.command('version', async (ctx) => {
    await showBotVersion(ctx)
})

bot.command('sync', async (ctx) => {
    await ifAdmin(ctx, () => syncrhonizeDbByUser(ctx))
})

bot.hears(/.+/, (ctx, next) => {
    console.debug(`@${ctx.from.username} (id=${ctx.from.id}): [type=${ctx.updateType}], [text=${ctx.message.text}]`)
    return next()
})


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
