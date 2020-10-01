import Telegraf, { BaseScene, Extra, Markup } from 'telegraf'
import { chidrensTags, ContextMessageUpdate, EventFormat, TagLevel2 } from '../../interfaces/app-interfaces'
import { i18nSceneHelper, sleep } from '../../util/scene-helper'
import TelegrafI18n from 'telegraf-i18n'
import { InlineKeyboardButton } from 'telegraf/typings/markup'
import { getNextWeekEndRange, SessionEnforcer } from '../shared/shared-logic'
import { cardFormat } from '../shared/card-format'
import plural from 'plural-ru'
import { formatExplainCennosti, formatExplainOblasti, formatExplainTime } from './format-explain'
import { i18n } from '../../util/i18n'
import { mapUserInputToTimeIntervals } from './customize-utils'
import { db } from '../../db'

const scene = new BaseScene<ContextMessageUpdate>('customize_scene');

const limitToPage = 3
const {backButton, sceneHelper, actionName, i18nModuleBtnName, revertActionName} = i18nSceneHelper(scene)

function mapFormatToDbQuery(format: string[]) {
    if (format === undefined || format.length !== 1) {
        return undefined;
    }
    return format[0] as EventFormat
}

async function countFilteredEvents(ctx: ContextMessageUpdate) {
    if (ctx.session.customize.resultsFound === undefined) {
        ctx.session.customize.resultsFound = await db.repoCustomEvents.countEventsCustomFilter({
            timeIntervals: mapUserInputToTimeIntervals(ctx.session.customize.time, getNextWeekEndRange()),
            weekendRange: getNextWeekEndRange(),
            cennosti: ctx.session.customize.cennosti,
            oblasti: ctx.session.customize.oblasti,
            format: mapFormatToDbQuery(ctx.session.customize.format)
        })
    }
    return ctx.session.customize.resultsFound;
}

const content = async (ctx: ContextMessageUpdate) => {
    const {i18Btn, i18Msg} = sceneHelper(ctx)

    const keyboard = [
        [
            Markup.button(i18Btn('oblasti')),
            Markup.button(i18Btn('priorities'))
        ],
        [
            Markup.button(i18Btn('time')),
            Markup.button(i18Btn('format'))
        ],
        [Markup.button(i18Btn('show_personalized_events'))],
        [backButton(ctx)],
    ]

    return {
        markup: Extra.HTML().markup(Markup.keyboard(keyboard).resize())
    }
}

function checkboxName(isSelected: boolean) {
    return `checkbox_${isSelected ? 'on' : 'off'}`;
}

type SectionName = 'oblasti_section' | 'cennosti_section' | 'time_section' | 'format_section'

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
            case 'format_section':
                return actionName(`f_${postfix}`)
            default:
                throw new Error(`Unknown section name ${this.section}`);
        }
    }

    dropDownButtons(menuTitle: string, submenus: string[][], menuTitleData = {}): InlineKeyboardButton[][] {
        const {i18Btn} = sceneHelper(this.ctx)

        const decorateTag = (tag: string) => ['oblasti_section', 'time_section'].includes(this.section)
            ? `${menuTitle.replace('menu_', '')}.${tag}`
            : tag

        const isAnySubmenuSelected = submenus
            .flatMap(m => m)
            .find(tag => this.selected.includes(decorateTag(tag))) !== undefined;

        const menuTitleWord = i18Btn(`${this.section}.${menuTitle}`, menuTitleData)
        const isOpen = this.openedMenus.includes(menuTitle)
        const menuTitleFull = i18Btn(`menu_${isOpen ? 'open' : 'closed'}`, {
            title: menuTitleWord,
            checkbox: i18Btn(checkboxName(isAnySubmenuSelected)),
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
            ['#короткийметр']
        ])),
        ...(menu.dropDownButtons('menu_concerts', [
            ['#сольныйконцерт'],
            ['#сборныйконцерт'],
            ['#камерныйконцерт'],
            ['#классическийконцерт'],
            ['#творческийвечер']
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
            ['#опера'],
            ['#танец'],
            ['#мюзикл'],
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
    const weekdays = getNextWeekEndRange().map(t => t.locale('ru').format('DD.MM'))

    function getIntervalsFromI18N(day: string) {
        return i18n.resourceKeys('ru')
            .filter(key => key.startsWith(`scenes.customize_scene.keyboard.time_section.${day}.`))
            .map(key => [key.replace(/^.+[.](?=[^.]+$)/, '')])
    }

    const buttons = [
        ...(menu.dropDownButtons('menu_saturday', [
            ...getIntervalsFromI18N('saturday')
        ], { date: weekdays[0] })),
        ...(menu.dropDownButtons('menu_sunday', [
            ...getIntervalsFromI18N('sunday')
        ], { date: weekdays[1] })),
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

async function getKeyboardFormat(ctx: ContextMessageUpdate) {
    const menu = new Menu(ctx, ctx.session.customize.format, ctx.session.customize.openedMenus, 'format_section')

    const buttons = [
        [menu.button('online'), menu.button('outdoor')]
    ]
    return Markup.inlineKeyboard(buttons)
}

function resetOpenMenus(ctx: ContextMessageUpdate) {
    prepareSessionStateIfNeeded(ctx)
    ctx.session.customize.openedMenus = []
}

async function resetFilter(ctx: ContextMessageUpdate) {
    resetPaging(ctx)
    ctx.session.customize.oblasti = []
    ctx.session.customize.cennosti = []
    ctx.session.customize.time = []
}

async function showNextPortionOfResults(ctx: ContextMessageUpdate) {
    prepareSessionStateIfNeeded(ctx)
    const {i18Btn, i18Msg} = sceneHelper(ctx)

    const events = await db.repoCustomEvents.findEventsCustomFilter({
        cennosti: ctx.session.customize.cennosti,
        oblasti: ctx.session.customize.oblasti,
        format: mapFormatToDbQuery(ctx.session.customize.format),
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

        await ctx.replyWithHTML(i18Msg('nothing_found', {body: getExplainFilterBody(ctx)}))
    }
}

async function generateAmountSelectedPlural(ctx: ContextMessageUpdate, i18Msg: (id: string, tplData?: object, byDefault?: string) => string) {
    const count = await countFilteredEvents(ctx)
    return plural(count, i18Msg('plural.event.one'), i18Msg('plural.event.two'), i18Msg('plural.event.many'))
}

async function putOrRefreshCounterMessage(ctx: ContextMessageUpdate) {
    const {i18Msg} = sceneHelper(ctx)

    const msg = i18Msg('select_counter', { eventPlural: await generateAmountSelectedPlural(ctx, i18Msg) })

    if (ctx.session.customize.eventsCounterMsgText !== msg) {
        if (ctx.session.customize.eventsCounterMsgId === undefined) {
            const counterMsg = await ctx.replyWithHTML(msg)
            // console.log(' > putOrRefreshCounterMessage fresh msg: ', counterMsg.message_id)
            ctx.session.customize.eventsCounterMsgId = counterMsg.message_id
        } else {
            // console.log(' > putOrRefreshCounterMessage update old msg: ', ctx.session.customize.eventsCounterMsgId)
            await ctx.telegram.editMessageText(ctx.chat.id, ctx.session.customize.eventsCounterMsgId, undefined, msg, {parse_mode: 'HTML'})
        }
        ctx.session.customize.eventsCounterMsgText = msg
    } else {
        // console.log(' > putOrRefreshCounterMessage: ', 'message is same')
    }
}

function getExplainFilterBody(ctx: ContextMessageUpdate): string {
    const {i18Btn, i18Msg} = sceneHelper(ctx)
    let lines: string[] = [];
    lines = [...lines, ...formatExplainTime(ctx, i18Msg)]
    lines = [...lines, ...formatExplainOblasti(ctx, i18Msg)]
    lines = [...lines, ...formatExplainCennosti(ctx, i18Msg)]
    return lines.join('\n')
}

export async function getMsgExplainFilter(ctx: ContextMessageUpdate): Promise<string|undefined> {
    const {i18Btn, i18Msg} = sceneHelper(ctx)
    prepareSessionStateIfNeeded(ctx)

    const body = getExplainFilterBody(ctx)

    if (body !== '') {
        const count = await countFilteredEvents(ctx)
        const eventPlural = plural(count, i18Msg('plural.event.one'), i18Msg('plural.event.two'), i18Msg('plural.event.many'))
        return i18Msg('explain_filter.layout', { body, eventPlural })
    }
    return undefined
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
        .hears(i18nModuleBtnName('format'), async (ctx: ContextMessageUpdate) => {
            const {i18Btn, i18Msg} = sceneHelper(ctx)

            prepareSessionStateIfNeeded(ctx)
            resetOpenMenus(ctx)
            await ctx.replyWithHTML(i18Msg('select_format'), Extra.markup((await getKeyboardFormat(ctx))))
            await ctx.replyWithHTML(i18Msg('select_footer'), Extra.markup((await getMarkupKeyboard(ctx))))

            await putOrRefreshCounterMessage(ctx)
        })
        .hears(i18nModuleBtnName('show_personalized_events'), async (ctx: ContextMessageUpdate) => {
            await showNextPortionOfResults(ctx)
        })
        .hears(i18nModuleBtnName('reset_filter'), async (ctx: ContextMessageUpdate) => {
            await resetFilter(ctx)
            await goBackToCustomize(ctx)
            await putOrRefreshCounterMessage(ctx)
        })
        .hears(i18nModuleBtnName('go_back_to_customize'), async (ctx: ContextMessageUpdate) => {
            await goBackToCustomize(ctx)
        })
    ;


}

async function goBackToCustomize(ctx: ContextMessageUpdate) {
    prepareSessionStateIfNeeded(ctx)
    const {i18Msg} = sceneHelper(ctx)
    const explainMsg = await getMsgExplainFilter(ctx)
    const msg = explainMsg !== undefined ? explainMsg : i18Msg('welcome')

    const { markup} = await content(ctx)
    await ctx.replyWithMarkdown(msg, markup)
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

function formatOptionLogic(ctx: ContextMessageUpdate, selected: string) {
    if (ctx.session.customize.format.includes(selected)) {
        ctx.session.customize.format = ctx.session.customize.format.filter(s => s !== selected)
    } else {
        ctx.session.customize.format.push(selected)
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


scene
    .enter(async (ctx: ContextMessageUpdate) => {
        console.log('enter customize-scene')

        prepareSessionStateIfNeeded(ctx)

        const {i18Msg} = sceneHelper(ctx)
        const { markup} = await content(ctx)
        await ctx.replyWithMarkdown(i18Msg('welcome'), markup)
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
        const {i18Msg} = sceneHelper(ctx)
        await ctx.editMessageReplyMarkup(await getKeyboardCennosti(ctx, ctx.session.customize))
        await ctx.answerCbQuery(i18Msg('popup_selected',
            { eventPlural:  await generateAmountSelectedPlural(ctx, i18Msg) }))
        await putOrRefreshCounterMessage(ctx)
    })
    .action(/customize_scene[.]o_(.+)/, async (ctx: ContextMessageUpdate) => {
        oblastiOptionLogic(ctx, ctx.match[1])
        // await ctx.answerCbQuery()
        const {i18Msg} = sceneHelper(ctx)
        await ctx.editMessageReplyMarkup(await getKeyboardOblasti(ctx))
        await ctx.answerCbQuery(i18Msg('popup_selected',
            { eventPlural:  await generateAmountSelectedPlural(ctx, i18Msg) }))
        await putOrRefreshCounterMessage(ctx)
    })
    .action(/customize_scene[.]t_(.+)/, async (ctx: ContextMessageUpdate) => {
        timeOptionLogic(ctx, ctx.match[1])

        const {i18Msg} = sceneHelper(ctx)

        await ctx.editMessageReplyMarkup(await getKeyboardTime(ctx))
        await ctx.answerCbQuery(i18Msg('popup_selected',
            { eventPlural:  await generateAmountSelectedPlural(ctx, i18Msg) }))
        await putOrRefreshCounterMessage(ctx)
    })
    .action(/customize_scene[.]f_(.+)/, async (ctx: ContextMessageUpdate) => {
        formatOptionLogic(ctx, ctx.match[1])

        const {i18Msg} = sceneHelper(ctx)

        await ctx.editMessageReplyMarkup(await getKeyboardFormat(ctx))
        await ctx.answerCbQuery(i18Msg('popup_selected',
            { eventPlural:  await generateAmountSelectedPlural(ctx, i18Msg) }))
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
        oblasti,
        format
    } = ctx.session.customize || {}

    ctx.session.customize = {
        openedMenus: SessionEnforcer.array(openedMenus),
        cennosti: SessionEnforcer.array(cennosti),
        oblasti: SessionEnforcer.array(oblasti),
        time: SessionEnforcer.array(time),
        format: SessionEnforcer.array(format),
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
    format: string[]
    eventsCounterMsgId?: number
    eventsCounterMsgText: string
    pagingOffset: number
    resultsFound: number
}

export type WeekDayTimeSlot = {
    ['6']?: string[]
    ['7']?: string[]
}

export interface CustomizeSceneTimeState {
    weekdays: WeekDayTimeSlot
}

export type Slot = '12:00-13:00' | '13:00-14:00';
