import { match } from 'telegraf-i18n';
import Stage from 'telegraf/stage';
import Scene from 'telegraf/scenes/base';
import logger from '../../util/logger';
import { getBackKeyboard, getMainKeyboard } from '../../util/keyboards';
import { loadTop5Events } from './repo'
import { ContextMessageUpdate, EventCategory } from '../../interfaces/app-interfaces'


const {leave} = Stage;
const theaters = new Scene('theaters');

function formatEvent(row: Event) {
    let text = ``;
    text += `**${row.title}**\n`
    text += '\n'
    text += `${row.description} \n`
    text += '\n'
    text += `Где: ${row.address}\n`
    text += `Время: ${row.timetable}\n`
    text += `Длительность прогулки: ${row.duration}\n`
    text += `Стоимость: ${row.price}\n`
    text += `Особенности:  ${row.notes}\n`
    text += '\n'
    text += `${row.url}\n`
    text += '\n'
    text += `${row.tag_level_1}\n`
    text += `${row.tag_level_2}\n`
    text += `${row.tag_level_3}\n`
    return text;
}

theaters.enter(async (ctx: ContextMessageUpdate) => {
    logger.debug(ctx, 'Enter theaters scene');
    const {backKeyboard} = getBackKeyboard(ctx);

    const theathers = await loadTop5Events('theatre');

    for (let i = 0; i < theathers.length; i++) {
        await ctx.reply(formatEvent(theathers[i]));
    }
    if (theathers.length == 0) {
        await ctx.reply(ctx.i18n.t('scenes.theaters.no_movies_found'));
    }

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
