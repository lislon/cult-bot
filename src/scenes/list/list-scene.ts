import { match } from 'telegraf-i18n';
import { Stage, BaseScene } from 'telegraf'
import logger from '../../util/logger';
import { getBackKeyboard, getMainKeyboard } from '../../util/keyboards';
import { ContextMessageUpdate, EventCategory } from '../../interfaces/app-interfaces'
import { formatEvent } from './formatEvent'
import { findTopEventsInRange } from '../../db/events'
import moment = require('moment')

declare class MyScene extends BaseScene<ContextMessageUpdate> {
    constructor(id: EventCategory);
}

const scenes: MyScene[] = [
    new BaseScene<ContextMessageUpdate>('theaters'),
    new BaseScene<ContextMessageUpdate>('exhibitions'),
    new BaseScene<ContextMessageUpdate>('movies'),
    new BaseScene<ContextMessageUpdate>('events'),
    new BaseScene<ContextMessageUpdate>('walks'),
    new BaseScene<ContextMessageUpdate>('concerts'),
]

function getWeekdaysRange() {
    const now = moment().tz('Europe/Moscow')
    const weekendEnds = moment().tz('Europe/Moscow').endOf('week')
    const weekendStarts = weekendEnds.clone().subtract(2, 'day')

    const range = [moment.max(now, weekendStarts), weekendEnds]
    return range
}

scenes.forEach((scene: MyScene)  => {

    scene.enter(async (ctx: ContextMessageUpdate) => {
        logger.debug(ctx, 'Enter list ' + scene.id);
        const {backKeyboard} = getBackKeyboard(ctx);

        const range = getWeekdaysRange()
        const events = await findTopEventsInRange(scene.id as EventCategory, range);

        for (const event of events) {
            await ctx.replyWithHTML(formatEvent(event), { disable_web_page_preview: true });
        }

        if (events.length == 0) {
            await ctx.reply(ctx.i18n.t('scenes.list.nothing_found'), backKeyboard);
        } else {
            await ctx.reply(ctx.i18n.t('scenes.list.welcome_to_list'), backKeyboard);
        }


    });

    scene.leave(async (ctx: ContextMessageUpdate) => {
        logger.debug(ctx, 'Leaves list scene');

        const {mainKeyboard} = getMainKeyboard(ctx);

        await ctx.reply(ctx.i18n.t('shared.what_next'), mainKeyboard );
    });

    scene.command('saveme', Stage.leave());
    scene.hears(match('keyboards.back_keyboard.back'), Stage.leave());
});

export default scenes;
