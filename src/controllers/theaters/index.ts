import { match } from 'telegraf-i18n';
import Stage from 'telegraf/stage';
import Scene from 'telegraf/scenes/base';
import logger from '../../util/logger';
import { getBackKeyboard, getMainKeyboard } from '../../util/keyboards';
import { loadTop5Events } from './repo'
import { ContextMessageUpdate, EventCategory } from '../../interfaces/app-interfaces'


const {leave} = Stage;
const theaters = new Scene('theaters');

const escapeHTML = (string: string) => {
    return string
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function formatEvent(row: Event) {


    let text = ``;
    text += `<b>${escapeHTML(row.title)}</b>\n`
    text += '\n'
    text += `${row.description} \n`
    text += '\n'
    text += `<b>Где:</b> ${row.address}\n`
    text += `<b>Время:</b> ${row.timetable}\n`
    text += `<b>Длительность:</b> ${row.duration}\n`
    text += `<b>Стоимость:</b> ${row.price}\n`
    text += `<b>Особенности:</b>  ${row.notes}\n`
    text += '\n'
    text += `<a href="${row.url}">${row.url}</a>\n`
    text += '\n'
    text += `${escapeHTML(row.tag_level_1)}\n`
    text += `${escapeHTML(row.tag_level_2)}\n`
    text += `${escapeHTML(row.tag_level_3)}\n`
    console.log(text)
    return text;
}

theaters.enter(async (ctx: ContextMessageUpdate) => {
    logger.debug(ctx, 'Enter theaters scene');
    const {backKeyboard} = getBackKeyboard(ctx);

    const theathers = await loadTop5Events('theaters');

    for (let i = 0; i < theathers.length; i++) {
        await ctx.replyWithHTML(formatEvent(theathers[i]));
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
