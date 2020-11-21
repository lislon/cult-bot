import { BaseScene, Composer, Extra, Markup } from 'telegraf'
import { chidrensTags, ContextMessageUpdate, EventFormat, TagLevel2 } from '../../interfaces/app-interfaces'
import { i18nSceneHelper, sleep } from '../../util/scene-helper'
import { InlineKeyboardButton } from 'telegraf/typings/markup'
import {
    checkboxi18nBtn,
    getNextWeekEndRange,
    limitEventsToPage,
    SessionEnforcer,
    warnAdminIfDateIsOverriden
} from '../shared/shared-logic'
import { cardFormat } from '../shared/card-format'
import plural from 'plural-ru'
import {
    filterPastIntervals,
    formatExplainCennosti,
    formatExplainFormat,
    formatExplainOblasti,
    formatExplainTime
} from './format-explain'
import { i18n } from '../../util/i18n'
import { mapUserInputToTimeIntervals } from './customize-utils'
import { db } from '../../db/db'
import { addDays, format } from 'date-fns/fp'
import { Paging } from '../shared/paging'
import { getISODay, startOfISOWeek } from 'date-fns'
import { SceneRegister } from '../../middleware-utils'

const scene = new BaseScene<ContextMessageUpdate>('customize_scene');

const {backButton, actionName, i18nModuleBtnName, revertActionName, scanKeys, i18nSharedBtnName} = i18nSceneHelper(scene)

function mapFormatToDbQuery(format: string[]) {
    if (format === undefined || format.length !== 1) {
        return undefined;
    }
    return format[0] as EventFormat
}

async function countFilteredEvents(ctx: ContextMessageUpdate) {
    if (ctx.session.customize.resultsFound === undefined) {
        ctx.session.customize.resultsFound = await db.repoCustomEvents.countEventsCustomFilter({
            timeIntervals: mapUserInputToTimeIntervals(ctx.session.customize.time, getNextWeekEndRange(ctx.now())),
            weekendRange: getNextWeekEndRange(ctx.now()),
            cennosti: ctx.session.customize.cennosti,
            oblasti: ctx.session.customize.oblasti,
            format: mapFormatToDbQuery(ctx.session.customize.format)
        })
    }
    return ctx.session.customize.resultsFound;
}

const content = async (ctx: ContextMessageUpdate) => {
    const keyboard = [
        [
            Markup.button(ctx.i18Btn('oblasti')),
            Markup.button(ctx.i18Btn('priorities'))
        ],
        [
            Markup.button(ctx.i18Btn('time')),
            Markup.button(ctx.i18Btn('format'))
        ],
        [Markup.button(ctx.i18Btn('show_personalized_events'))],
        [backButton(ctx)],
    ]

    return {
        markup: Extra.HTML().markup(Markup.keyboard(keyboard).resize())
    }
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
        const isSelected = this.selected.includes(tag)
        const text = this.ctx.i18Btn(`${this.section}.${tag}`) + checkboxi18nBtn(this.ctx, isSelected)
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
        const decorateTag = (tag: string) => ['oblasti_section', 'time_section'].includes(this.section)
            ? `${menuTitle.replace('menu_', '')}.${tag}`
            : tag

        const isAnySubmenuSelected = submenus
            .flatMap(m => m)
            .find(tag => this.selected.includes(decorateTag(tag))) !== undefined;

        const menuTitleWord = this.ctx.i18Btn(`${this.section}.${menuTitle}`, menuTitleData)
        const isOpen = this.openedMenus.includes(menuTitle)
        const menuTitleFull = this.ctx.i18Btn(`menu_${isOpen ? 'open' : 'closed'}`, {
            title: menuTitleWord,
            checkbox: checkboxi18nBtn(this.ctx, isAnySubmenuSelected),
        })
        return [
            [Markup.callbackButton(menuTitleFull, this.actionName(menuTitle))],
            ...submenus.map(rows => rows.map(tag => this.button(decorateTag(tag), !isOpen)))
        ]
    }

}

async function getKeyboardCennosti(ctx: ContextMessageUpdate, state: CustomizeSceneState) {
    const menu = new Menu(ctx, state.cennosti, state.openedMenus, 'cennosti_section')

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

    const getSectionFromI18n = (section: string): [string][] => {
        return scanKeys(`keyboard.oblasti_section.${section}`).map(t => [t.replace(/^[^#]+/, '')])
    }

    const buttons = [
        ...(menu.dropDownButtons('menu_movies',
            getSectionFromI18n(`movies`)
        )),
        ...(menu.dropDownButtons('menu_concerts',
            getSectionFromI18n(`concerts`)
        )),
        ...(menu.dropDownButtons('menu_exhibitions_temp',
            getSectionFromI18n(`exhibitions_temp`)
        )),
        ...(menu.dropDownButtons('menu_exhibitions_perm',
            getSectionFromI18n(`exhibitions_perm`)
        )),
        ...(menu.dropDownButtons('menu_theaters',
            getSectionFromI18n(`theaters`)
        )),
        ...(menu.dropDownButtons('menu_events',
            getSectionFromI18n(`events`)
        )),
        ...(menu.dropDownButtons('menu_walks',
            getSectionFromI18n('walks')
        ))
    ]
    return Markup.inlineKeyboard(buttons)
}

/**
 * generates a times like [
 * ['sunday.00:00-06:00'],
 * ['sunday.06:00-12:00']
 * ]
 */
function generateDropdownTimes(weekday: 'saturday'|'sunday', now: Date) {
    function getIntervalsFromI18N(day: string) {
        return i18n.resourceKeys('ru')
            .filter(key => key.startsWith(`scenes.customize_scene.keyboard.time_section.${day}.`))
            .map(key => [key.replace(/^.+[.](?=[^.]+$)/, '')])
    }

    const isoDate = weekday == 'saturday' ? 6 : 7;
    return filterPastIntervals(
        getIntervalsFromI18N(weekday).map(i => i[0]),
        getISODay(now) === isoDate ? now : undefined
    ).map(i => [i])
}

async function getKeyboardTime(ctx: ContextMessageUpdate) {
    const menu = new Menu(ctx, ctx.session.customize.time, ctx.session.customize.openedMenus, 'time_section')
    const weekdays = [0, 1]
        .map(i => addDays(i)(getNextWeekEndRange(startOfISOWeek(ctx.now())).start))
        .map(d => format('dd.MM', d))

    let buttons: InlineKeyboardButton[][] = []
    if (getISODay(ctx.now()) <= 6) {
        const sat = menu.dropDownButtons('menu_saturday', generateDropdownTimes('saturday', ctx.now()), {date: weekdays[0]})
        buttons = [...buttons, ...sat]
    }
    if (getISODay(ctx.now()) <= 7) {
        const sun = menu.dropDownButtons('menu_sunday', generateDropdownTimes('sunday', ctx.now()), {date: weekdays[1]})
        buttons = [...buttons, ...sun]
    }

    return Markup.inlineKeyboard(buttons)
}

async function getMarkupKeyboard(ctx: ContextMessageUpdate) {
    return Markup.keyboard([
        [
            Markup.button(ctx.i18Btn('reset_filter')),
            Markup.button(ctx.i18Btn('show_personalized_events', {count: await countFilteredEvents(ctx)}))
        ],
        [Markup.button(ctx.i18SharedBtn('back'))],
        [Markup.button(ctx.i18Btn('go_back_to_main'))]
    ]).resize()
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
    ctx.session.customize.format = []
}

async function showNextPortionOfResults(ctx: ContextMessageUpdate) {
    prepareSessionStateIfNeeded(ctx)

    const events = await db.repoCustomEvents.findEventsCustomFilter({
        cennosti: ctx.session.customize.cennosti,
        oblasti: ctx.session.customize.oblasti,
        format: mapFormatToDbQuery(ctx.session.customize.format),
        timeIntervals: mapUserInputToTimeIntervals(ctx.session.customize.time, getNextWeekEndRange(ctx.now())),
        weekendRange: getNextWeekEndRange(ctx.now()),
        limit: limitEventsToPage,
        offset: ctx.session.paging.pagingOffset
    })

    const totalCount = await countFilteredEvents(ctx)

    let count = 0
    for (const event of events) {
        const nextBtn = Markup.inlineKeyboard([
            Markup.callbackButton(ctx.i18Btn('show_more'), actionName('show_more'))
        ])
        await ctx.replyWithHTML(cardFormat(event), {
            disable_web_page_preview: true,
            reply_markup: (++count == events.length && ctx.session.paging.pagingOffset + count != totalCount ? nextBtn : undefined)
        })
        await sleep(200)
    }

    if (events.length === 0) {
        await ctx.replyWithHTML(ctx.i18Msg('nothing_found', {body: getExplainFilterBody(ctx)}))
    }

    if (ctx.session.paging.pagingOffset === 0) {
        ctx.ua.pv({dp: `/customize/results/`, dt: `Подобрать под себя / ${totalCount} результатов`})

        const searchByTags = [
            ...ctx.session.customize.cennosti,
            ...ctx.session.customize.oblasti,
            ...ctx.session.customize.format,
            ...ctx.session.customize.time]
        searchByTags.forEach(tag => ctx.ua.e('customize', 'search_tag', tag))
    }
}

async function generateAmountSelectedPlural(ctx: ContextMessageUpdate) {
    const count = await countFilteredEvents(ctx)
    return plural(count, ctx.i18Msg('plural.event.one'), ctx.i18Msg('plural.event.two'), ctx.i18Msg('plural.event.many'))
}

async function putOrRefreshCounterMessage(ctx: ContextMessageUpdate) {
    const msg = ctx.i18Msg('select_counter', {eventPlural: await generateAmountSelectedPlural(ctx)})

    if (ctx.session.customize.eventsCounterMsgText !== msg) {
        if (ctx.session.customize.eventsCounterMsgId === undefined) {
            const counterMsg = await ctx.replyWithHTML(msg)
            ctx.session.customize.eventsCounterMsgId = counterMsg.message_id
        } else {
            await ctx.telegram.editMessageText(ctx.chat.id, ctx.session.customize.eventsCounterMsgId, undefined, msg, {parse_mode: 'HTML'})
        }
        ctx.session.customize.eventsCounterMsgText = msg
    }
}

function resetBottomMessageWithNumberOfEventsFound(ctx: ContextMessageUpdate) {
    ctx.session.customize.eventsCounterMsgText = undefined
    ctx.session.customize.eventsCounterMsgId = undefined
}

function getExplainFilterBody(ctx: ContextMessageUpdate): string {
    let lines: string[] = [];
    lines = [...lines, ...formatExplainTime(ctx)]
    lines = [...lines, ...formatExplainOblasti(ctx)]
    lines = [...lines, ...formatExplainCennosti(ctx)]
    lines = [...lines, ...formatExplainFormat(ctx)]
    return lines.join('\n')
}

export async function getMsgExplainFilter(ctx: ContextMessageUpdate): Promise<string | undefined> {
    prepareSessionStateIfNeeded(ctx)

    const body = getExplainFilterBody(ctx).trim()

    if (body !== '') {
        const count = await countFilteredEvents(ctx)
        const eventPlural = plural(count, ctx.i18Msg('plural.event.one'), ctx.i18Msg('plural.event.two'), ctx.i18Msg('plural.event.many'))
        return ctx.i18Msg('explain_filter.layout', {body, eventPlural})
    }
    return undefined
}

async function withSubdialog(ctx: ContextMessageUpdate, callback: () => Promise<void>) {
    ctx.session.customize.currentStage = 'sub_dialog'
    prepareSessionStateIfNeeded(ctx)
    resetOpenMenus(ctx)
    resetBottomMessageWithNumberOfEventsFound(ctx)

    await callback()
    await ctx.replyWithHTML(ctx.i18Msg('select_footer'), Extra.markup((await getMarkupKeyboard(ctx))))

    await putOrRefreshCounterMessage(ctx)
}

function globalActionsFn(bot: Composer<ContextMessageUpdate>) {
    bot
        .hears(i18nModuleBtnName('oblasti'), async (ctx: ContextMessageUpdate) => {

            await withSubdialog(ctx, async () => {
                await ctx.replyWithHTML(ctx.i18Msg('select_oblasti'), Extra.markup((await getKeyboardOblasti(ctx))))
                ctx.ua.pv({dp: `/customize/oblasti/`, dt: `Подобрать под себя / Области`})
            })

        })
        .hears(i18nModuleBtnName('priorities'), async (ctx: ContextMessageUpdate) => {

            await withSubdialog(ctx, async () => {
                await ctx.replyWithHTML(ctx.i18Msg('select_priorities'), Extra.markup((await getKeyboardCennosti(ctx, ctx.session.customize))))
                ctx.ua.pv({dp: `/customize/priorities/`, dt: `Подобрать под себя / Приоритеты`})
            })

        })
        .hears(i18nModuleBtnName('time'), async (ctx: ContextMessageUpdate) => {
            await withSubdialog(ctx, async () => {
                await ctx.replyWithHTML(ctx.i18Msg('select_time'), Extra.markup((await getKeyboardTime(ctx))))
                ctx.ua.pv({dp: `/customize/time/`, dt: `Подобрать под себя / Время`})
            })

        })
        .hears(i18nModuleBtnName('format'), async (ctx: ContextMessageUpdate) => {
            await withSubdialog(ctx, async () => {
                await ctx.replyWithHTML(ctx.i18Msg('select_format'), Extra.markup((await getKeyboardFormat(ctx))))
                ctx.ua.pv({dp: `/customize/format/`, dt: `Подобрать под себя / Формат`})
            })
        })
        .hears(i18nModuleBtnName('show_personalized_events'), async (ctx: ContextMessageUpdate) => {
            await warnAdminIfDateIsOverriden(ctx)
            await showNextPortionOfResults(ctx)
        })
        .hears(i18nModuleBtnName('reset_filter'), async (ctx: ContextMessageUpdate) => {
            await resetFilter(ctx)
            await goBackToCustomize(ctx)
            await putOrRefreshCounterMessage(ctx)
        })
}

async function goBackToCustomize(ctx: ContextMessageUpdate) {
    prepareSessionStateIfNeeded(ctx)
    const explainMsg = await getMsgExplainFilter(ctx)
    const msg = explainMsg !== undefined ? explainMsg : ctx.i18Msg('welcome')
    ctx.session.customize.currentStage = 'root_dialog'

    const {markup} = await content(ctx)
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
        ctx.session.customize.format = []
    } else {
        ctx.session.customize.format = [selected]
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
        prepareSessionStateIfNeeded(ctx)

        const {markup} = await content(ctx)
        await ctx.replyWithMarkdown(ctx.i18Msg('welcome'), markup)

        ctx.ua.pv({dp: `/customize/`, dt: `Подобрать под себя`})
    })
    .leave((ctx: ContextMessageUpdate) => {
        ctx.session.customize = undefined
    })
    .use(Paging.pagingMiddleware(actionName('show_more'),
        async (ctx: ContextMessageUpdate) => {
            Paging.increment(ctx, limitEventsToPage)
            await ctx.editMessageReplyMarkup()
            await showNextPortionOfResults(ctx)
        }))
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
        resetPaging(ctx)
        await ctx.editMessageReplyMarkup(await getKeyboardCennosti(ctx, ctx.session.customize))
        await ctx.answerCbQuery(ctx.i18Msg('popup_selected',
            {eventPlural: await generateAmountSelectedPlural(ctx)}))
        await putOrRefreshCounterMessage(ctx)
    })
    .action(/customize_scene[.]o_(.+)/, async (ctx: ContextMessageUpdate) => {
        oblastiOptionLogic(ctx, ctx.match[1])
        resetPaging(ctx)
        // await ctx.answerCbQuery()
        await ctx.editMessageReplyMarkup(await getKeyboardOblasti(ctx))
        await ctx.answerCbQuery(ctx.i18Msg('popup_selected',
            {eventPlural: await generateAmountSelectedPlural(ctx)}))
        await putOrRefreshCounterMessage(ctx)
    })
    .action(/customize_scene[.]t_(.+)/, async (ctx: ContextMessageUpdate) => {
        timeOptionLogic(ctx, ctx.match[1])
        resetPaging(ctx)

        await ctx.editMessageReplyMarkup(await getKeyboardTime(ctx))
        await ctx.answerCbQuery(ctx.i18Msg('popup_selected',
            {eventPlural: await generateAmountSelectedPlural(ctx)}))
        await putOrRefreshCounterMessage(ctx)
    })
    .action(/customize_scene[.]f_(.+)/, async (ctx: ContextMessageUpdate) => {
        formatOptionLogic(ctx, ctx.match[1])
        resetPaging(ctx)

        await ctx.editMessageReplyMarkup(await getKeyboardFormat(ctx))
        await ctx.answerCbQuery(ctx.i18Msg('popup_selected',
            {eventPlural: await generateAmountSelectedPlural(ctx)}))
        await putOrRefreshCounterMessage(ctx)
    })
    .hears(i18nSharedBtnName('back'), async (ctx: ContextMessageUpdate) => {
        prepareSessionStateIfNeeded(ctx)
        if (ctx.session.customize.currentStage === 'root_dialog') {
            await ctx.scene.enter('main_scene')
        } else {
            await goBackToCustomize(ctx)
        }
    })
;


function resetPaging(ctx: ContextMessageUpdate) {
    prepareSessionStateIfNeeded(ctx)
    Paging.reset(ctx)
    ctx.session.customize.resultsFound = undefined;
}

function prepareSessionStateIfNeeded(ctx: ContextMessageUpdate) {
    Paging.prepareSession(ctx)

    const {
        openedMenus,
        cennosti,
        time,
        resultsFound,
        eventsCounterMsgId,
        eventsCounterMsgText,
        oblasti,
        format,
        currentStage
    } = ctx.session.customize || {}

    ctx.session.customize = {
        openedMenus: SessionEnforcer.array(openedMenus),
        cennosti: SessionEnforcer.array(cennosti),
        oblasti: SessionEnforcer.array(oblasti),
        time: SessionEnforcer.array(time),
        format: SessionEnforcer.array(format),
        eventsCounterMsgText,
        currentStage: currentStage || 'root_dialog',
        resultsFound: SessionEnforcer.number(resultsFound),

        eventsCounterMsgId: SessionEnforcer.number(eventsCounterMsgId),
    }
}

export const customizeScene = {
    scene,
    globalActionsFn
} as SceneRegister

export interface CustomizeSceneState {
    time: string[]
    openedMenus: string[]
    cennosti: TagLevel2[]
    oblasti: string[]
    format: string[]
    eventsCounterMsgId?: number
    eventsCounterMsgText: string
    resultsFound: number
    currentStage: 'root_dialog'|'sub_dialog'
}
