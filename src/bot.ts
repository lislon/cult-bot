import Telegraf, { ContextMessageUpdate, Stage, Telegram } from 'telegraf'
import session from 'telegraf/session';
import logger from './util/logger';
import asyncWrapper from './util/error-handler'
const rateLimit = require('telegraf-ratelimit')
import { getMainKeyboard } from './util/keyboards';
import TelegrafI18n, { match } from 'telegraf-i18n';
import rp from 'request-promise';
import path from 'path'
import theaters from './controllers/theaters'
import { config } from 'dotenv'
import { RateLimitConfig } from 'telegraf-ratelimit';
import updateLogger from 'telegraf-update-logger'

console.log(process.env);
config();

// console.log(`starting bot... ${process.env.TELEGRAM_TOKEN}`);
const bot: Telegraf<ContextMessageUpdate> = new Telegraf(process.env.TELEGRAM_TOKEN)

const i18n = new TelegrafI18n({
    defaultLanguage: 'ru',
    directory: path.resolve(__dirname, 'locales'),
    useSession: false,
    allowMissing: false,
    sessionName: 'session'
});

// Set limit to 9 messages per 3 seconds
const limitConfig: RateLimitConfig = {
    window: 3000,
    limit: 9,
    onLimitExceeded: (ctx: ContextMessageUpdate) => ctx.reply('Rate limit exceeded')
}

const stage = new Stage([
    theaters,
]);

bot.use(session());
bot.use(i18n.middleware());
bot.use(stage.middleware());
bot.use(rateLimit(limitConfig))
bot.use(updateLogger({ colors: true }))

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
bot.hears(match('keyboards.back_keyboard.back'), async (ctx) => {
    const { mainKeyboard } = getMainKeyboard(ctx);
    await ctx.reply(ctx.i18n.t('shared.what_next'), mainKeyboard);
});

bot.hears(/.+/, (ctx, next) => {
    // console.debug(ctx)
    console.debug(`@${ctx.from.username}: ${ctx.message.text}`)
})

process.env.NODE_ENV === 'production' ? startProdMode(bot) : startDevMode(bot);

function startDevMode(bot: Telegraf<ContextMessageUpdate>) {
    logger.debug(undefined, 'Starting a bot in development mode');

    rp(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/deleteWebhook`).then(() =>
        bot.startPolling()
    );
}

async function startProdMode(bot: Telegraf<ContextMessageUpdate>) {
    // If webhook not working, check fucking motherfucking UFW that probably blocks a port...
    logger.debug(undefined, 'Starting a bot in production mode');
    // const tlsOptions = {
    //     key: fs.readFileSync(process.env.PATH_TO_KEY),
    //     cert: fs.readFileSync(process.env.PATH_TO_CERT)
    // };

    if (process.env.HEROKU_APP_NAME) {
        console.log('Set hook:' + `https://${process.env.HEROKU_APP_NAME}.herokuapp.com:${process.env.PORT}/${process.env.TELEGRAM_TOKEN}`)


        await bot.telegram.setWebhook(
            `https://${process.env.HEROKU_APP_NAME}.herokuapp.com:${process.env.PORT}/${process.env.TELEGRAM_TOKEN}`
        );

        await bot.startWebhook(`/${process.env.TELEGRAM_TOKEN}`, undefined, +process.env.PORT);

        const webhookStatus = await bot.telegram.getWebhookInfo();
        console.log('Webhook status', webhookStatus);
    } else {
        console.log('process.env.HEROKU_APP_NAME must be defined to run in PROD')
    }

    // checkUnreleasedMovies();
}
