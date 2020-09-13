import { match } from 'telegraf-i18n';
import { Stage, BaseScene } from 'telegraf'
import logger from '../../util/logger';
import { getBackKeyboard, getMainKeyboard } from '../../util/keyboards';
import { loadTop5Events } from './repo'
import { ContextMessageUpdate, EventCategory } from '../../interfaces/app-interfaces'
import { formatEvent } from './formatEvent'

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

scenes.forEach((scene: MyScene)  => {

    scene.enter(async (ctx: ContextMessageUpdate) => {
        logger.debug(ctx, 'Enter list ' + scene.id);
        const {backKeyboard} = getBackKeyboard(ctx);

        const events = await loadTop5Events(scene.id as EventCategory);

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
