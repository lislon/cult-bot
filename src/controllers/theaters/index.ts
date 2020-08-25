import { ContextMessageUpdate } from 'telegraf';
import { match } from 'telegraf-i18n';
import Stage from 'telegraf/stage';
import Scene from 'telegraf/scenes/base';
import logger from '../../util/logger';
import { getBackKeyboard, getMainKeyboard } from '../../util/keyboards';


const {leave} = Stage;
const theaters = new Scene('theaters');


theaters.enter(async (ctx: ContextMessageUpdate) => {
    logger.debug(ctx, 'Enter theaters scene');
    const {backKeyboard} = getBackKeyboard(ctx);

    for (let i = 0; i < 2; i++) {
        await ctx.reply('' + i);
    }
    // deleteFromSession(ctx, 'movies');


    await ctx.reply(ctx.i18n.t('scenes.theaters.welcome_to_theaters'), backKeyboard);
});

theaters.leave(async (ctx: ContextMessageUpdate) => {
    logger.debug(ctx, 'Leaves theaters scene');

    const {mainKeyboard} = getMainKeyboard(ctx);

    await ctx.reply(ctx.i18n.t('shared.what_next'), mainKeyboard);
});

theaters.command('saveme', leave());
theaters.hears(match('keyboards.back_keyboard.back'), leave());

export default theaters;
