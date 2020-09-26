import Telegraf, { BaseScene, Extra, Markup } from 'telegraf'
import { chidrensTags, ContextMessageUpdate, TagLevel2 } from '../../interfaces/app-interfaces'
import { backButtonRegister, sleep } from '../../util/scene-helper'
import TelegrafI18n from 'telegraf-i18n'
import { InlineKeyboardButton } from 'telegraf/typings/markup'
import { countEventsCustomFilter, findEventsCustomFilter } from '../../db/custom-filter'
import { getNextWeekEndRange } from '../shared/shared-logic'
import { cardFormat } from '../shared/card-format'

const scene = new BaseScene<ContextMessageUpdate>('customize_scene');

const limitToPage = 3
const {backButton, sceneHelper, actionName, i18nModuleBtnName} = backButtonRegister(scene)

async function countFilteredEvents(ctx: ContextMessageUpdate) {
    if (ctx.session.customize.resultsFound === undefined) {
        ctx.session.customize.resultsFound = await countEventsCustomFilter({
            weekendRange: getNextWeekEndRange(),
            cennosti: ctx.session.customize.cennosti
        })
    }
    return ctx.session.customize.resultsFound;
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
        [Markup.callbackButton(i18Btn('show_personalized_events', {count: await countFilteredEvents(ctx)}), actionName('show_filtered_events'))]
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

async function showNextPortionOfResults(ctx: ContextMessageUpdate) {
    prepareSessionStateIfNeeded(ctx)
    const {i18Btn, i18Msg} = sceneHelper(ctx)

    const events = await findEventsCustomFilter({
        cennosti: ctx.session.customize.cennosti,
        weekendRange: getNextWeekEndRange(),
        limit: limitToPage,
        offset: ctx.session.customize.pagingOffset
    })

    const totalCount = await countFilteredEvents(ctx)

    let count = 0
    for (const event of events) {
        const nextBtn = Markup.inlineKeyboard([
            Markup.callbackButton(i18Btn('show_more'), actionName('show_more'))
        ])
        await ctx.replyWithHTML(cardFormat(event), {
            disable_web_page_preview: true,
            reply_markup: (++count == events.length && ctx.session.customize.pagingOffset + count != totalCount ? nextBtn : undefined)
        })
        await sleep(200)
    }

    if (events.length === 0) {
        await ctx.replyWithHTML(i18Msg('nothing_found'))
    }
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
            await showNextPortionOfResults(ctx)
        })
    ;


}

function childrenOptionLogic(ctx: ContextMessageUpdate, selected: TagLevel2) {
    if (ctx.session.customize.cennosti.includes(selected)) {
        ctx.session.customize.cennosti = ctx.session.customize.cennosti.filter(s => s !== selected)
    } else {
        if (chidrensTags.includes(selected)) {
            ctx.session.customize.cennosti = ctx.session.customize.cennosti.filter(s => !chidrensTags.includes(s))
        }
        ctx.session.customize.cennosti.push(selected)
    }
}

scene
    .enter(async (ctx: ContextMessageUpdate) => {
        prepareSessionStateIfNeeded(ctx)
        console.log('enter customize-scene')

        const {msg, markup} = await content(ctx)
        await ctx.replyWithMarkdown(msg, markup)
    })
    .leave((ctx: ContextMessageUpdate) => {
        resetPaging(ctx)
    })
    .action(actionName('oblasti'), nothing)
    .action(actionName('priorities'), nothing)
    .action(/.+/, (ctx: ContextMessageUpdate, next) => {
        if (ctx.match[0] !== actionName('show_more')) {
            resetPaging(ctx)
        }
        return next()
    })
    .hears(/.+/, (ctx: ContextMessageUpdate, next) => {
        resetPaging(ctx)
        return next()
    })
    .action(actionName('show_more'), async (ctx: ContextMessageUpdate) => {
        ctx.session.customize.pagingOffset += limitToPage;
        await ctx.editMessageReplyMarkup()
        await showNextPortionOfResults(ctx)
    })
    .action(actionName('show_filtered_events'), async (ctx: ContextMessageUpdate) => {
        await ctx.answerCbQuery()
        await showNextPortionOfResults(ctx)
    })
    .action(/customize_scene[.](menu_.+)/, async (ctx: ContextMessageUpdate) => {
        const menuState = ctx.session.customize.uiMenuState
        menuState.set(ctx.match[1], !menuState.get(ctx.match[1]))

        await ctx.editMessageReplyMarkup(await getKeyboard(ctx, ctx.session.customize))
    })
    .action(/customize_scene[.]p_(.+)/, async (ctx: ContextMessageUpdate) => {
        const selected = ctx.match[1] as TagLevel2

        childrenOptionLogic(ctx, selected)

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
        // console.log('customize-scene-back')
        await ctx.scene.enter('customize_scene')
    });


function resetPaging(ctx: ContextMessageUpdate) {
    prepareSessionStateIfNeeded(ctx)
    ctx.session.customize.pagingOffset = 0;
    ctx.session.customize.resultsFound = undefined;
}

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
            },
            resultsFound: undefined,
            pagingOffset: 0
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
    pagingOffset: number
    resultsFound: number
}

export interface CustomizeSceneTimeState {
    weekdays: WeekDayTimeSlot
}

export type WeekDayTimeSlot = {
    ['6']?: string[]
    ['7']?: string[]
}

export type Slot = '12:00-13:00' | '13:00-14:00';