import { BaseScene, Extra, Markup } from 'telegraf'
import { allCategories, ContextMessageUpdate, EventCategory } from '../../interfaces/app-interfaces'
import { backButtonRegister } from '../../util/scene-helper'
import { getTopEvents } from './retrieve-logic'
import { cardFormat } from './card-format'
import * as events from 'events'
import { filterByByRange } from '../../lib/timetable/intervals'
import { mskMoment } from '../../util/moment-msk'
import { Moment } from 'moment'

export interface MainSceneState {
    gcMessages: number[]
    messageId: number
}

const scene = new BaseScene<ContextMessageUpdate>('main_scene');

const {backButton, sceneHelper, actionName} = backButtonRegister(scene)

const content = (ctx: ContextMessageUpdate) => {

    const {i18Btn, i18Msg} = sceneHelper(ctx)

    const menu = [
        ['theaters', 'exhibitions'],
        ['movies', 'events'],
        ['walks', 'concerts'],
        ['customize']
    ]

    const mainButtons = menu.map(row =>
        row.map(btnName => {
            return Markup.callbackButton(i18Btn(btnName), actionName(btnName));
        })
    );
    return {
        msg: i18Msg('select_category'),
        markup: Extra.HTML(true).markup(Markup.inlineKeyboard(mainButtons))
    }
}

scene.enter(async (ctx: ContextMessageUpdate) => {
    const {msg, markup} = content(ctx)

    if (ctx.session.mainScene === undefined) {
        ctx.session.mainScene = {
            gcMessages: [],
            messageId: undefined
        }
    }

    ctx.session.mainScene.messageId = (await ctx.replyWithMarkdown(msg, markup)).message_id
})

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function cleanOldMessages(ctx: ContextMessageUpdate) {
    for (const messageId of ctx.session.mainScene.gcMessages) {
        await ctx.deleteMessage(messageId)
    }
    ctx.session.mainScene.gcMessages = []
    if (ctx.session.mainScene.messageId !== undefined) {
        await ctx.deleteMessage(ctx.session.mainScene.messageId)
        ctx.session.mainScene.messageId = undefined
    }
}

function isWeekendsNow(range: [Moment, Moment]) {
    return filterByByRange([mskMoment()], range, 'in').length > 0
}

async function showEvents(ctx: ContextMessageUpdate, cat: EventCategory) {
    const {i18Btn, i18Msg} = sceneHelper(ctx)
    const {range, events} = await getTopEvents(cat)
    const intervalTemplateParams = {
        from: range[0].locale('ru').format('DD.MM HH:mm'),
        to: range[1].locale('ru').subtract('1', 'second').format('DD.MM HH:mm')
    }

    await cleanOldMessages(ctx)

    if (isWeekendsNow(range)) {
        await ctx.replyWithHTML(i18Msg('let_me_show_this_weekend', intervalTemplateParams))
    } else {
        await ctx.replyWithHTML(i18Msg('let_me_show_next_weekend', intervalTemplateParams))
    }

    for (const event of events) {
        const msgId = (await ctx.replyWithHTML(cardFormat(event), {disable_web_page_preview: true})).message_id;
        ctx.session.mainScene.gcMessages.push(msgId)
        await sleep(1000)
    }

    const {msg, markup} = content(ctx)
    if (events.length == 0) {


        await ctx.reply(ctx.i18n.t('nothing_found_in_interval', intervalTemplateParams), markup);
    } else {
        ctx.session.mainScene.messageId = (await ctx.replyWithMarkdown(msg, markup)).message_id
    }
}

for (const cat of allCategories) {
    scene.action(actionName(cat), async (ctx: ContextMessageUpdate) => {
        await ctx.answerCbQuery()
        await showEvents(ctx, cat as EventCategory)
    });
}


// declare class MyScene extends BaseScene<ContextMessageUpdate> {
//     constructor(id: EventCategory);
// }
//
// const scenes: MyScene[] = [
//     new BaseScene<ContextMessageUpdate>('theaters'),
//     new BaseScene<ContextMessageUpdate>('exhibitions'),
//     new BaseScene<ContextMessageUpdate>('movies'),
//     new BaseScene<ContextMessageUpdate>('events'),
//     new BaseScene<ContextMessageUpdate>('walks'),
//     new BaseScene<ContextMessageUpdate>('concerts'),
// ]
//
// scenes.forEach((scene: MyScene)  => {
//
//     scene.enter(async (ctx: ContextMessageUpdate) => {
//         const {backKeyboard} = getBackKeyboard(ctx);
//
//         const {range, events} = await getTopEvents(scene.id as EventCategory)
//
//         for (const event of events) {
//             await ctx.replyWithHTML(cardFormat(event), { disable_web_page_preview: true });
//         }
//
//         if (events.length == 0) {
//             await ctx.reply(ctx.i18n.t('scenes.list.nothing_found_in_interval', {
//                 from: range[0].locale('ru').format('DD.MM HH:mm'),
//                 to: range[1].locale('ru').subtract('1', 'second').format('DD.MM HH:mm')
//             }), backKeyboard);
//         } else {
//             await ctx.reply(ctx.i18n.t('scenes.list.welcome_to_list'), backKeyboard);
//         }
//
//     });
//
//     scene.leave(async (ctx: ContextMessageUpdate) => {
//         logger.debug(ctx, 'Leaves list scene');
//
//         const {mainKeyboard} = getMainKeyboard(ctx);
//
//         await ctx.reply(ctx.i18n.t('shared.what_next'), mainKeyboard );
//     });
//
//     scene.command('start', Stage.leave());
//     scene.hears(match('keyboards.back_keyboard.back'), Stage.leave());
// });
//
// export default scenes;
// for (const cat of allCategories) {
//     bot.action(cat, asyncWrapper(async (ctx: ContextMessageUpdate) => await ctx.scene.enter(cat)));
// }

export { scene as mainScene }
