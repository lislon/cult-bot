import Telegraf, { ContextMessageUpdate, Stage } from 'telegraf'
import logger from './util/logger';
import asyncWrapper from './util/error-handler'
import { getMainKeyboard } from './util/keyboards';
import TelegrafI18n, { match } from 'telegraf-i18n';
import path from 'path'
import theaters from './controllers/theaters'

const bot = new Telegraf('1294938975:AAF3Hwba7WjpqGDy8OUUnECHvVYT_nVnKPw')

const i18n = new TelegrafI18n({
    defaultLanguage: 'ru',
    directory: path.resolve(__dirname, 'locales'),
    useSession: false,
    allowMissing: false,
    sessionName: 'session'
});

// bot.use(session());

const stage = new Stage([
    theaters,
]);

bot.use(i18n.middleware());
bot.use(stage.middleware());


bot.start(asyncWrapper(async (ctx: ContextMessageUpdate) => ctx.scene.enter('start')));


bot.command('/saveme', async (ctx: ContextMessageUpdate) => {
    logger.debug(ctx, 'User uses /saveme command');

    const { mainKeyboard } = getMainKeyboard(ctx);
    await ctx.reply(ctx.i18n.t('shared.what_next'), mainKeyboard);
});

bot.hears(
    match('keyboards.main_keyboard.theaters'),
    asyncWrapper(async (ctx: ContextMessageUpdate) => await ctx.scene.enter('theaters'))
);

bot.hears(
    match('keyboards.main_keyboard.exhibitions'),
    asyncWrapper(async (ctx: ContextMessageUpdate) => await ctx.scene.enter('exhibitions'))
);


bot.start((ctx) => ctx.reply('Welcome!'))
bot.help((ctx) => ctx.reply('Send me a sticker'))
bot.on('sticker', (ctx) => ctx.reply('👍'))
bot.hears('hi', (ctx) => ctx.reply('Hey there'))
bot.launch()