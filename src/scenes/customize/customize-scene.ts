import Telegraf, { BaseScene, Extra, Markup } from 'telegraf'
import { chidrensTags, ContextMessageUpdate, TagLevel2 } from '../../interfaces/app-interfaces'
import { backButtonRegister } from '../../util/scene-helper'
import TelegrafI18n from 'telegraf-i18n'
import { InlineKeyboardButton } from 'telegraf/typings/markup'
import { countEventsCustomFilter } from '../../db/custom-filter'
import { getNextWeekEndRange } from '../shared/shared-logic'

const scene = new BaseScene<ContextMessageUpdate>('customize_scene');

const {backButton, sceneHelper, actionName, i18nModuleBtnName} = backButtonRegister(scene)

async function countFilteredEvents(ctx: ContextMessageUpdate) {
    return await countEventsCustomFilter({
        limit: 3,
        offset: 0,
        weekendRange: getNextWeekEndRange(),
        cennosti: ctx.session.customize.cennosti
    })
}

const content = async (ctx: ContextMessageUpdate) => {
    const {i18Btn, i18Msg} = sceneHelper(ctx)

    const keyboard = [
        [
            Markup.button(i18Btn('timetable')),
            Markup.button(i18Btn('oblasti')),
            Markup.button(i18Btn('priorities'))
        ],
        [Markup.button(i18Btn('show_personalized_events', {count: await countFilteredEvents(ctx)}))],
        [backButton(ctx)],
    ]

    return {
        msg: i18Msg('welcome'),
        markup: Extra.HTML(true).markup(Markup.keyboard(keyboard).resize())
    }
}

function putCheckbox(isSelected: boolean) {
    return isSelected ? ' ✔' : ''
}

class Menu {
    private readonly selected: string[]
    private readonly uiMenusState: UIMenusState
    private readonly ctx: ContextMessageUpdate
    private readonly section: string

    constructor(ctx: ContextMessageUpdate, selected: string[], uiMenusState: UIMenusState) {
        this.selected = selected
        this.uiMenusState = uiMenusState;
        this.ctx = ctx;
        this.section = 'interests'
    }

    button(tag: string, hide: boolean = false): InlineKeyboardButton {
        const {i18Btn} = sceneHelper(this.ctx)

        const isSelected = this.selected.includes(tag)
        return Markup.callbackButton(i18Btn(`${this.section}.${tag}`) + putCheckbox(isSelected), actionName(`p_${tag}`), hide)
    }

    dropDownButtons(title: string, submenus: string[]): InlineKeyboardButton[][] {
        const {i18Btn} = sceneHelper(this.ctx)

        const isAnySubmenuSelected = submenus.find(tag => this.selected.includes(tag)) !== undefined;

        const menuTitle = i18Btn(`${this.section}.${title}`)
        const isOpen = this.uiMenusState.get(title)
        return [
            [Markup.callbackButton((isOpen ? '➖ ' : '➕ ') + menuTitle + putCheckbox(isAnySubmenuSelected), actionName(`${title}`))],
            [...submenus.map(tag => this.button(tag, !isOpen))]
        ]
    }

}

async function getKeyboard(ctx: ContextMessageUpdate, state: CustomizeSceneState) {
    const menu = new Menu(ctx, state.cennosti, state.uiMenuState)
    const {i18Btn} = sceneHelper(ctx)

    const buttons = [
        [menu.button('#комфорт')],
        [menu.button('#премьера')],
        [menu.button('#навоздухе')],
        [menu.button('#компанией')],
        [menu.button('#ЗОЖ')],
        [menu.button('#новыеформы')],
        [menu.button('#успетьзачас')],
        [menu.button('#культурныйбазис')],
        ...(menu.dropDownButtons('menu_стоимость', ['#доступноподеньгам', '#бесплатно'])),
        ...(menu.dropDownButtons('menu_childrens', chidrensTags)),
        [Markup.callbackButton(i18Btn('show_personalized_events', {count: await countFilteredEvents(ctx)}), 'show')]
    ]
    return Markup.inlineKeyboard(buttons)
}


async function getMarkupKeyboard(ctx: ContextMessageUpdate) {
    const {i18Btn} = sceneHelper(ctx)
    const markupKeyabord = Markup.keyboard([
        [Markup.button(i18Btn('show_personalized_events', {count: await countFilteredEvents(ctx)}))],
        [Markup.button(i18Btn('go_back_to_customize'))],
        [Markup.button(i18Btn('go_back_to_main'))]
    ]).resize()
    return markupKeyabord
}

function registerActions(bot: Telegraf<ContextMessageUpdate>, i18n: TelegrafI18n) {
    bot
        .hears(i18nModuleBtnName('oblasti'), async (ctx: ContextMessageUpdate) => {
            // please_select_priorities
            await prepareSessionStateIfNeeded(ctx)
            // const strings = await loadAllOblasti()
            // strings.push(i18n.t(`ru`, 'shared.keyboard.back', {}))

            // const keyboard = Markup.keyboard(strings, {
            //      columns: 2
            //  })


            await ctx.replyWithHTML('Oblsati')
        })
        .hears(i18nModuleBtnName('priorities'), async (ctx: ContextMessageUpdate) => {
            const {i18Btn, i18Msg} = sceneHelper(ctx)

            await prepareSessionStateIfNeeded(ctx)
            const inlineKeyboard = await getKeyboard(ctx, ctx.session.customize)


            const msg = await ctx.replyWithHTML(i18Msg('select_priorities'), Extra.markup((inlineKeyboard)))
            const markupKbMsg = await ctx.replyWithHTML(i18Msg('select_priorities_footer'), Extra.markup((await getMarkupKeyboard(ctx))))
            // ctx.session.customize.markupKbId = markupKbMsg.message_id
            // const msg = await ctx.replyWithHTML(i18Msg('select_priorities'))

            // await sleep(1000)
            // const markup = Extra.inReplyTo(msg.message_id)
            // await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, 'lisa', Extra.markup((inlineKeyboard)))
        })
        .hears(/события по фильтру/, async (ctx: ContextMessageUpdate) => {
            await ctx.replyWithHTML('скоро будет')
        })
    ;


}

scene
    .enter(async (ctx: ContextMessageUpdate) => {
        prepareSessionStateIfNeeded(ctx)
        console.log('enter customize-scene')

        const {msg, markup} = await content(ctx)
        await ctx.replyWithMarkdown(msg, markup)
    })
    .action(actionName('oblasti'), nothing)
    .action(actionName('priorities'), nothing)
    .action(/customize_scene[.](menu_.+)/, async (ctx: ContextMessageUpdate) => {
        const menuState = ctx.session.customize.uiMenuState
        menuState.set(ctx.match[1], !menuState.get(ctx.match[1]))

        await ctx.editMessageReplyMarkup(await getKeyboard(ctx, ctx.session.customize))
    })
    .action(/customize_scene[.]p_(.+)/, async (ctx: ContextMessageUpdate) => {
        const selected = ctx.match[1] as TagLevel2

        if (ctx.session.customize.cennosti.includes(selected)) {
            ctx.session.customize.cennosti = ctx.session.customize.cennosti.filter(s => s !== selected)
        } else {
            if (chidrensTags.includes(selected)) {
                ctx.session.customize.cennosti = ctx.session.customize.cennosti.filter(s => !chidrensTags.includes(s))
            }
            ctx.session.customize.cennosti.push(selected)
        }

        await ctx.editMessageReplyMarkup(await getKeyboard(ctx, ctx.session.customize))

        // const {i18Btn, i18Msg} = sceneHelper(ctx)
        // if (ctx.session.customize.markupKbId === undefined) {
        //     const markupKbMsg = await ctx.replyWithHTML(`По вашему фильтру ${await countFilteredEvents(ctx)} событий`)
        //     ctx.session.customize.markupKbId = markupKbMsg.message_id
        // } else {
        //     const nm = await ctx.telegram.editMessageText(ctx.chat.id, ctx.session.customize.markupKbId, undefined, `По вашему фильтру ${await countFilteredEvents(ctx)} событий`)
        // }
        //  editMessageText('qq', Extra.inReplyTo(ctx.session.customize.markupKbId).markup((markupKeyabord)))
    })
    .hears(i18nModuleBtnName('go_back_to_customize'), async (ctx: ContextMessageUpdate) => {
        console.log('customize-scene-back')
        await ctx.scene.enter('customize_scene')
    });


function prepareSessionStateIfNeeded(ctx: ContextMessageUpdate) {
    if (ctx.session.customize === undefined) {
        ctx.session.customize = {
            uiMenuState: new Map(),
            cennosti: [],
            time: {
                weekdays: {
                    '6': [],
                    '7': []
                }
            }
        }
    }
}


async function nothing(ctx: ContextMessageUpdate) {
    await ctx.reply('Пока тут ничего нет :(')
}


export {
    scene as customizeScene,
    registerActions as customizeRegisterActions
}

export interface UIMenusState extends Map<string, boolean> {
}

export interface CustomizeSceneState {
    time: CustomizeSceneTimeState
    uiMenuState: UIMenusState
    cennosti: TagLevel2[]
    markupKbId?: number
}

export interface CustomizeSceneTimeState {
    weekdays: WeekDayTimeSlot
}

export type WeekDayTimeSlot = {
    ['6']?: string[]
    ['7']?: string[]
}

export type Slot = '12:00-13:00' | '13:00-14:00';