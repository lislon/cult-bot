import Telegraf, { BaseScene, Extra, Markup } from 'telegraf'
import { chidrensTags, ContextMessageUpdate, TagLevel2 } from '../../interfaces/app-interfaces'
import { i18nSceneHelper, sleep } from '../../util/scene-helper'
import TelegrafI18n from 'telegraf-i18n'
import { InlineKeyboardButton } from 'telegraf/typings/markup'
import { countEventsCustomFilter, findEventsCustomFilter } from '../../db/custom-filter'
import { getNextWeekEndRange, SessionEnforcer } from '../shared/shared-logic'
import { cardFormat } from '../shared/card-format'
import plural from 'plural-ru'
import { i18n } from '../../middleware-utils'
import { Moment } from 'moment'
import { formatExplainCennosti, formatExplainOblasti, formatExplainTime } from './format-explain'

const scene = new BaseScene<ContextMessageUpdate>('customize_scene');

const limitToPage = 3
const {backButton, sceneHelper, actionName, i18nModuleBtnName, revertActionName} = i18nSceneHelper(scene)

export function mapUserInputToTimeIntervals(times: string[], [sat, sun]: Moment[]): Moment[][] {
    return (times)
        .map(t => t.split(/[-.]/))
        .map(([day, from, to]) => [
            day,
            +from.replace(/:00/, ''),
            +to.replace(/:00/, '')
        ])
        .flatMap(([day, from, to]) => {
            if (from < to) {
                return [[day, from, to]]
            } else {
                return [[day, 0, to], [day, from, 24]]
            }
        })
        .map(([day, from, to]: [string, number, number]) => {
            const baseDay = (day === 'saturday' ? sat : sun).clone().startOf('day')
            return [
                baseDay.clone().add(from, 'hour'),
                baseDay.clone().add(to, 'hour'),
            ]
        });
}

async function countFilteredEvents(ctx: ContextMessageUpdate) {
    if (ctx.session.customize.resultsFound === undefined) {
        ctx.session.customize.resultsFound = await countEventsCustomFilter({
            timeIntervals: mapUserInputToTimeIntervals(ctx.session.customize.time, getNextWeekEndRange()),
            weekendRange: getNextWeekEndRange(),
            cennosti: ctx.session.customize.cennosti,
            oblasti: ctx.session.customize.oblasti,
        })
    }
    return ctx.session.customize.resultsFound;
}

const content = async (ctx: ContextMessageUpdate) => {
    const {i18Btn, i18Msg} = sceneHelper(ctx)

    const keyboard = [
        [
            Markup.button(i18Btn('time')),
            Markup.button(i18Btn('oblasti')),
            Markup.button(i18Btn('priorities'))
        ],
        [Markup.button(i18Btn('show_personalized_events', {count: await countFilteredEvents(ctx)}))],
        [backButton(ctx)],
    ]

    return {
        msg: i18Msg('welcome'),
        markup: Extra.HTML().markup(Markup.keyboard(keyboard).resize())
    }
}

function checkboxName(isSelected: boolean) {
    return `checkbox_${isSelected ? 'on' : 'off'}`;
}

type SectionName = 'oblasti_section' | 'cennosti_section' | 'time_section'

class Menu {
    private readonly selected: string[]
    private readonly openedMenus: string[]
    private readonly ctx: ContextMessageUpdate
    private readonly section: SectionName

    constructor(ctx: ContextMessageUpdate,
                selected: string[],
                openedMenus: string[],
                section: SectionName) {
        this.selected = selected
        this.openedMenus = openedMenus;
        this.ctx = ctx;
        this.section = section
    }

    button(tag: string, hide: boolean = false): InlineKeyboardButton {
        const {i18Btn} = sceneHelper(this.ctx)

        const isSelected = this.selected.includes(tag)
        const text = i18Btn(`${this.section}.${tag}`) + i18Btn(checkboxName(isSelected))
        return Markup.callbackButton(text, this.actionName(`${tag}`), hide)
    }

    private actionName(postfix: string) {
        switch (this.section) {
            case 'cennosti_section':
                return actionName(`p_${postfix}`)
            case 'oblasti_section':
                return actionName(`o_${postfix}`)
            case 'time_section':
                return actionName(`t_${postfix}`)
            default:
                throw new Error(`Unknown section name ${this.section}`);
        }
    }

    dropDownButtons(menuTitle: string, submenus: string[][]): InlineKeyboardButton[][] {
        const {i18Btn} = sceneHelper(this.ctx)

        const decorateTag = (tag: string) => ['oblasti_section', 'time_section'].includes(this.section)
            ? `${menuTitle.replace('menu_', '')}.${tag}`
            : tag

        const isAnySubmenuSelected = submenus
            .flatMap(m => m)
            .find(tag => this.selected.includes(decorateTag(tag))) !== undefined;

        const menuTitleWord = i18Btn(`${this.section}.${menuTitle}`)
        const isOpen = this.openedMenus.includes(menuTitle)
        const menuTitleFull = i18Btn(`menu_${isOpen ? 'open' : 'closed'}`, {
            title: menuTitleWord,
            checkbox: i18Btn(checkboxName(isAnySubmenuSelected))
        })
        return [
            [Markup.callbackButton(menuTitleFull, this.actionName(menuTitle))],
            ...submenus.map(rows => rows.map(tag => this.button(decorateTag(tag), !isOpen)))
        ]
    }

}

async function getKeyboardCennosti(ctx: ContextMessageUpdate, state: CustomizeSceneState) {
    const menu = new Menu(ctx, state.cennosti, state.openedMenus, 'cennosti_section')
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
        ...(menu.dropDownButtons('menu_cost', [['#доступноподеньгам', '#бесплатно']])),
        ...(menu.dropDownButtons('menu_childrens', [chidrensTags]))
        // [Markup.callbackButton(i18Btn('show_personalized_events', {count: await countFilteredEvents(ctx)}), actionName('show_filtered_events'))]
    ]
    return Markup.inlineKeyboard(buttons)
}

async function getKeyboardOblasti(ctx: ContextMessageUpdate) {
    const menu = new Menu(ctx, ctx.session.customize.oblasti, ctx.session.customize.openedMenus, 'oblasti_section')

    const buttons = [
        ...(menu.dropDownButtons('menu_movies', [
            ['#художественное'],
            ['#документальное'],
            ['#анимация'],
            ['#короткийметр'],
            ['#фестиваль']
        ])),
        ...(menu.dropDownButtons('menu_concerts', [
            ['#сольныйконцерт'],
            ['#сборныйконцерт'],
            ['#камерныйконцерт'],
            ['#классическийконцерт'],
            ['#творческийвечер'],
            ['#фестиваль']
        ])),
        ...(menu.dropDownButtons('menu_exhibitions', [
            ['#постояннаяэкспозиция'],
            ['#выставочныйпроект'],
            ['#персональнаявыставка'],
            ['#доммузей']
        ])),
        ...(menu.dropDownButtons('menu_theaters', [
            ['#драматическийтеатр'],
            ['#эксперимент'],
            ['#опера', '#танец'],
            ['#фестиваль', '#мюзикл'],
            ['#аудиоспектакль'],
            ['#кукольныйтеатр'],
        ])),
        ...(menu.dropDownButtons('menu_events', [
            ['#лекция'],
            ['#встречасперсоной'],
            ['#мастеркласс'],
            ['#курс'],
            ['#подкаст']
        ])),
        ...(menu.dropDownButtons('menu_walks', [
            ['#активныйотдых'],
            ['#городсгидом'],
            ['#загородсгидом'],
            ['#аудиоэкскурсия'],
            ['#знакомствоспространством'],
        ]))
    ]
    return Markup.inlineKeyboard(buttons)
}

async function getKeyboardTime(ctx: ContextMessageUpdate) {
    const menu = new Menu(ctx, ctx.session.customize.time, ctx.session.customize.openedMenus, 'time_section')

    function getIntervalsFromI18N(day: string) {
        return i18n.resourceKeys('ru')
            .filter(key => key.startsWith(`scenes.customize_scene.keyboard.time_section.${day}.`))
            .map(key => [key.replace(/^.+[.](?=[^.]+$)/, '')])
    }

    const buttons = [
        ...(menu.dropDownButtons('menu_saturday', [
            ...getIntervalsFromI18N('saturday')
        ])),
        ...(menu.dropDownButtons('menu_sunday', [
            ...getIntervalsFromI18N('sunday')
        ])),
    ]
    return Markup.inlineKeyboard(buttons)
}

async function getMarkupKeyboard(ctx: ContextMessageUpdate) {
    const {i18Btn} = sceneHelper(ctx)
    const markupKeyabord = Markup.keyboard([
        [
            Markup.button(i18Btn('reset_filter')),
            Markup.button(i18Btn('show_personalized_events', {count: await countFilteredEvents(ctx)}))
        ],
        [Markup.button(i18Btn('go_back_to_customize'))],
        [Markup.button(i18Btn('go_back_to_main'))]
    ]).resize()
    return markupKeyabord
}

function resetOpenMenus(ctx: ContextMessageUpdate) {
    prepareSessionStateIfNeeded(ctx)
    ctx.session.customize.openedMenus = []
}

async function resetFilter(ctx: ContextMessageUpdate) {
    resetPaging(ctx)
    ctx.session.customize.oblasti = []
    ctx.session.customize.cennosti = []
    await putOrRefreshCounterMessage(ctx)
}

async function showNextPortionOfResults(ctx: ContextMessageUpdate) {
    prepareSessionStateIfNeeded(ctx)
    const {i18Btn, i18Msg} = sceneHelper(ctx)

    const events = await findEventsCustomFilter({
        cennosti: ctx.session.customize.cennosti,
        oblasti: ctx.session.customize.oblasti,
        timeIntervals: mapUserInputToTimeIntervals(ctx.session.customize.time, getNextWeekEndRange()),
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

async function putOrRefreshCounterMessage(ctx: ContextMessageUpdate) {
    const {i18Msg} = sceneHelper(ctx)

    const count = await countFilteredEvents(ctx)
    const eventPlural = plural(count, i18Msg('plural.event.one'), i18Msg('plural.event.two'), i18Msg('plural.event.many'))
    const msg = i18Msg('select_counter', {eventPlural})

    if (ctx.session.customize.eventsCounterMsgText !== msg) {
        if (ctx.session.customize.eventsCounterMsgId === undefined) {
            const counterMsg = await ctx.replyWithHTML(msg)
            console.log(' > putOrRefreshCounterMessage fresh msg: ', counterMsg.message_id)
            ctx.session.customize.eventsCounterMsgId = counterMsg.message_id
        } else {
            console.log(' > putOrRefreshCounterMessage update old msg: ', ctx.session.customize.eventsCounterMsgId)
            await ctx.telegram.editMessageText(ctx.chat.id, ctx.session.customize.eventsCounterMsgId, undefined, msg, {parse_mode: 'HTML'})
        }
        ctx.session.customize.eventsCounterMsgText = msg
    } else {
        console.log(' > putOrRefreshCounterMessage: ', 'message is same')
    }
}

export async function sendMsgExplainFilter(ctx: ContextMessageUpdate) {
    const {i18Btn, i18Msg} = sceneHelper(ctx)
    prepareSessionStateIfNeeded(ctx)

    let lines: string[] = [];
    lines = [...lines, ...formatExplainTime(ctx, i18Msg)]
    lines = [...lines, ...formatExplainOblasti(ctx, i18Msg)]
    lines = [...lines, ...formatExplainCennosti(ctx, i18Msg)]


    if (lines.length > 0) {
        await ctx.replyWithHTML(i18Msg('explain_filter.layout', { body: lines.join('\n') }))
    }
}

function registerActions(bot: Telegraf<ContextMessageUpdate>, i18n: TelegrafI18n) {
    bot
        .hears(i18nModuleBtnName('oblasti'), async (ctx: ContextMessageUpdate) => {
            const {i18Btn, i18Msg} = sceneHelper(ctx)

            prepareSessionStateIfNeeded(ctx)
            resetOpenMenus(ctx)

            await ctx.replyWithHTML(i18Msg('select_oblasti'), Extra.markup((await getKeyboardOblasti(ctx))))
            await ctx.replyWithHTML(i18Msg('select_footer'), Extra.markup((await getMarkupKeyboard(ctx))))

            await putOrRefreshCounterMessage(ctx)
        })
        .hears(i18nModuleBtnName('priorities'), async (ctx: ContextMessageUpdate) => {
            const {i18Btn, i18Msg} = sceneHelper(ctx)

            prepareSessionStateIfNeeded(ctx)
            resetOpenMenus(ctx)
            await ctx.replyWithHTML(i18Msg('select_priorities'), Extra.markup((await getKeyboardCennosti(ctx, ctx.session.customize))))
            await ctx.replyWithHTML(i18Msg('select_footer'), Extra.markup((await getMarkupKeyboard(ctx))))

            await putOrRefreshCounterMessage(ctx)
        })
        .hears(i18nModuleBtnName('time'), async (ctx: ContextMessageUpdate) => {
            const {i18Btn, i18Msg} = sceneHelper(ctx)

            prepareSessionStateIfNeeded(ctx)
            resetOpenMenus(ctx)
            await ctx.replyWithHTML(i18Msg('select_time'), Extra.markup((await getKeyboardTime(ctx))))
            await ctx.replyWithHTML(i18Msg('select_footer'), Extra.markup((await getMarkupKeyboard(ctx))))

            await putOrRefreshCounterMessage(ctx)
        })
        .hears(i18nModuleBtnName('show_personalized_events'), async (ctx: ContextMessageUpdate) => {
            await showNextPortionOfResults(ctx)
        })
        .hears(i18nModuleBtnName('reset_filter'), async (ctx: ContextMessageUpdate) => {
            await resetFilter(ctx)
        })
        .hears(i18nModuleBtnName('go_back_to_customize'), async (ctx: ContextMessageUpdate) => {
            await sendMsgExplainFilter(ctx)
            await customizeInitialScreen(ctx)
        })
    ;


}

function cennostiOptionLogic(ctx: ContextMessageUpdate, selected: string) {
    const tag = revertActionName(selected) as TagLevel2
    if (ctx.session.customize.cennosti.includes(tag)) {
        ctx.session.customize.cennosti = ctx.session.customize.cennosti.filter(s => s !== tag)
    } else {
        if (chidrensTags.includes(tag)) {
            ctx.session.customize.cennosti = ctx.session.customize.cennosti.filter(s => !chidrensTags.includes(s))
        }
        ctx.session.customize.cennosti.push(tag)
    }
}

function oblastiOptionLogic(ctx: ContextMessageUpdate, selected: string) {
    const [cat, tag] = selected.split('.')
    const tagRus = `${cat}.${revertActionName(tag)}`
    if (ctx.session.customize.oblasti.includes(tagRus)) {
        ctx.session.customize.oblasti = ctx.session.customize.oblasti.filter(s => s !== tagRus)
    } else {
        ctx.session.customize.oblasti.push(tagRus)
    }
}

function timeOptionLogic(ctx: ContextMessageUpdate, selected: string) {
    if (ctx.session.customize.time.includes(selected)) {
        ctx.session.customize.time = ctx.session.customize.time.filter(s => s !== selected)
    } else {
        ctx.session.customize.time.push(selected)
    }
}

function checkOrUncheckMenu(ctx: ContextMessageUpdate) {
    const menuTitle = ctx.match[1]
    if (ctx.session.customize.openedMenus.includes(menuTitle)) {
        ctx.session.customize.openedMenus = []
    } else {
        ctx.session.customize.openedMenus = [menuTitle]
    }
}

async function customizeInitialScreen(ctx: ContextMessageUpdate) {
    prepareSessionStateIfNeeded(ctx)

    const {msg, markup} = await content(ctx)
    await ctx.replyWithMarkdown(msg, markup)
}

scene
    .enter(async (ctx: ContextMessageUpdate) => {
        console.log('enter customize-scene')
        await customizeInitialScreen(ctx)
    })
    .leave((ctx: ContextMessageUpdate) => {
        console.log('leave customize-scene')
        ctx.session.customize = undefined
    })
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
    .action(/customize_scene[.]p_(menu_.+)/, async (ctx: ContextMessageUpdate) => {
        checkOrUncheckMenu(ctx)
        await ctx.editMessageReplyMarkup(await getKeyboardCennosti(ctx, ctx.session.customize))
    })
    .action(/customize_scene[.]o_(menu_.+)/, async (ctx: ContextMessageUpdate) => {
        checkOrUncheckMenu(ctx)
        await ctx.editMessageReplyMarkup(await getKeyboardOblasti(ctx))
    })
    .action(/customize_scene[.]t_(menu_.+)/, async (ctx: ContextMessageUpdate) => {
        checkOrUncheckMenu(ctx)
        await ctx.editMessageReplyMarkup(await getKeyboardTime(ctx))
    })
    .action(/customize_scene[.]p_(.+)/, async (ctx: ContextMessageUpdate) => {
        cennostiOptionLogic(ctx, ctx.match[1])
        await ctx.answerCbQuery()
        await ctx.editMessageReplyMarkup(await getKeyboardCennosti(ctx, ctx.session.customize))
        await putOrRefreshCounterMessage(ctx)
    })
    .action(/customize_scene[.]o_(.+)/, async (ctx: ContextMessageUpdate) => {
        oblastiOptionLogic(ctx, ctx.match[1])
        await ctx.answerCbQuery()
        await ctx.editMessageReplyMarkup(await getKeyboardOblasti(ctx))
        await putOrRefreshCounterMessage(ctx)
    })
    .action(/customize_scene[.]t_(.+)/, async (ctx: ContextMessageUpdate) => {
        timeOptionLogic(ctx, ctx.match[1])
        await ctx.answerCbQuery()
        await ctx.editMessageReplyMarkup(await getKeyboardTime(ctx))
        await putOrRefreshCounterMessage(ctx)
    })
;


function resetPaging(ctx: ContextMessageUpdate) {
    prepareSessionStateIfNeeded(ctx)
    ctx.session.customize.pagingOffset = 0;
    ctx.session.customize.resultsFound = undefined;
}

function prepareSessionStateIfNeeded(ctx: ContextMessageUpdate) {
    const {
        openedMenus,
        cennosti,
        time,
        resultsFound,
        pagingOffset,
        eventsCounterMsgId,
        eventsCounterMsgText,
        oblasti
    } = ctx.session.customize || {}

    ctx.session.customize = {
        openedMenus: SessionEnforcer.array(openedMenus),
        cennosti: SessionEnforcer.array(cennosti),
        oblasti: SessionEnforcer.array(oblasti),
        time: SessionEnforcer.array(time),
        eventsCounterMsgText,
        resultsFound: SessionEnforcer.number(resultsFound),
        pagingOffset: SessionEnforcer.number(pagingOffset),
        eventsCounterMsgId: SessionEnforcer.number(eventsCounterMsgId),
    }
}

async function nothing(ctx: ContextMessageUpdate) {
    await ctx.reply('Пока тут ничего нет :(')
}

export {
    scene as customizeScene,
    registerActions as customizeRegisterActions
}

export interface CustomizeSceneState {
    time: string[]
    openedMenus: string[]
    cennosti: TagLevel2[]
    oblasti: string[]
    eventsCounterMsgId?: number
    eventsCounterMsgText: string
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