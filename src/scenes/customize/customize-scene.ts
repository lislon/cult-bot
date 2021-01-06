import { BaseScene, Composer, Extra, Markup } from 'telegraf'
import { chidrensTags, ContextMessageUpdate, EventFormat, MyInterval, TagLevel2 } from '../../interfaces/app-interfaces'
import { i18nSceneHelper, sleep } from '../../util/scene-helper'
import { CallbackButton, InlineKeyboardButton } from 'telegraf/typings/markup'
import {
    checkboxi18nBtnId,
    generatePlural,
    getNextWeekendRange,
    limitEventsToPage,
    SessionEnforcer,
    warnAdminIfDateIsOverriden
} from '../shared/shared-logic'
import { cardFormat } from '../shared/card-format'
import {
    filterPastIntervals,
    formatExplainCennosti,
    formatExplainFormat,
    formatExplainOblasti,
    formatExplainTime
} from './format-explain'
import { i18n } from '../../util/i18n'
import { mapUserInputToTimeIntervals } from './customize-utils'
import { db } from '../../database/db'
import { addDays, format } from 'date-fns/fp'
import { Paging } from '../shared/paging'
import { getISODay, startOfISOWeek } from 'date-fns'
import { saveSession, SceneRegister } from '../../middleware-utils'
import { isEmpty } from 'lodash'
import { getLikesRow } from '../likes/likes-common'
import { InlineKeyboardMarkup } from 'telegram-typings'
import emojiRegex from 'emoji-regex'

const scene = new BaseScene<ContextMessageUpdate>('customize_scene');

const {backButton, actionName, i18nModuleBtnName, revertActionName, scanKeys, i18nSharedBtnName, i18Btn, i18Msg, i18SharedBtn} = i18nSceneHelper(scene)

function mapFormatToDbQuery(format: string[]) {
    if (format === undefined || format.length !== 1) {
        return undefined;
    }
    return format[0] as EventFormat
}

function cleanOblastiTag(ctx: ContextMessageUpdate) {
    return ctx.session.customize.oblasti
        .flatMap(o => {
            if (o === 'exhibitions_perm.#научнотехнические') {
                return [
                    'exhibitions.#наука',
                    'exhibitions.#техника',
                ]
            }
            return [o];
        })
        .map(o => o.replace(/_.+[.]#/, '.#')) //  "exhibitions_perm.#историколитературные" ->   "exhibitions.#историколитературные"
}

function prepareRepositoryQuery(ctx: ContextMessageUpdate) {
    return {
        timeIntervals: mapUserInputToTimeIntervals(ctx.session.customize.time, getNextWeekendRangeForCustom(ctx.now())),
        weekendRange: getNextWeekendRangeForCustom(ctx.now()),
        cennosti: ctx.session.customize.cennosti,
        oblasti: cleanOblastiTag(ctx),
        format: mapFormatToDbQuery(ctx.session.customize.format)
    }
}

async function countFilteredEvents(ctx: ContextMessageUpdate) {
    if (ctx.session.customize.resultsFound === undefined) {
        const query = prepareRepositoryQuery(ctx)
        ctx.session.customize.resultsFound = await db.repoCustomEvents.countEventsCustomFilter(query)
    }
    return ctx.session.customize.resultsFound;
}

async function showFilteredEventsButton(ctx: ContextMessageUpdate) {
    return Markup.callbackButton(i18Btn(ctx, 'show_personalized_events', {
        eventPlural: await generateAmountSelectedPlural(ctx)
    }), actionName('show_personalized_events'))
}

const getFilterMainButtons = async (ctx: ContextMessageUpdate): Promise<CallbackButton[][]> => {
    const selected = i18Btn(ctx, 'selected_filter_postfix')

    function btn(name: string, state: string[]): CallbackButton {
        return Markup.callbackButton(i18Btn(ctx, name) + (isEmpty(state) ? '' : ' ' + selected), actionName(name))
    }

    const keyboard = [
        [
            btn('oblasti', ctx.session.customize.oblasti),
            btn('priorities', ctx.session.customize.cennosti),
        ],
        [
            btn('time', ctx.session.customize.time),
            btn('format', ctx.session.customize.format),
        ],
        [
            await showFilteredEventsButton(ctx)
        ],
        // [
        //     Markup.callbackButton(i18Btn(ctx, 'back'), actionName('back')),
        // ],
    ]

    return keyboard
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

    button(tag: string): InlineKeyboardButton {
        const isSelected = this.selected.includes(tag)
        const text = i18Btn(this.ctx, `${this.section}.${tag}`) + checkboxi18nBtnId(this.ctx, isSelected)
        return Markup.callbackButton(text, this.actionName(`${tag}`))
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

        const menuTitleWord = i18Btn(this.ctx, `${this.section}.${menuTitle}`, menuTitleData)
        const isOpen = this.openedMenus.includes(menuTitle)
        const menuTitleFull = i18Btn(this.ctx, `menu_${isOpen ? 'open' : 'closed'}`, {
            title: menuTitleWord,
            checkbox: checkboxi18nBtnId(this.ctx, isAnySubmenuSelected),
        })
        const map: InlineKeyboardButton[][] = isOpen ? submenus.map(rows => rows.map(tag => this.button(decorateTag(tag)))) : []

        return [
            [Markup.callbackButton(menuTitleFull, this.actionName(menuTitle))],
            ...map
        ]
    }

}

async function getKeyboardCennosti(ctx: ContextMessageUpdate) {
    const state = ctx.session.customize
    const menu = new Menu(ctx, state.cennosti, state.openedMenus, 'cennosti_section')

    const buttons = [
        ...(menu.dropDownButtons('menu_childrens', [chidrensTags])),
        ...(menu.dropDownButtons('menu_cost', [['#бесплатно', '#доступноподеньгам', '#_недешево']])),
        [menu.button('#комфорт')],
        [menu.button('#премьера')],
        [menu.button('#навоздухе')],
        [menu.button('#компанией')],
        [menu.button('#ЗОЖ')],
        [menu.button('#новыеформы')],
        [menu.button('#успетьзачас')],
        [menu.button('#культурныйбазис')],
        // [Markup.callbackButton(i18Btn('show_personalized_events', {count: await countFilteredEvents(ctx)}), actionName('show_filtered_events'))]
    ]
    return buttons
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
        ...(menu.dropDownButtons('menu_exhibitions_perm',
            getSectionFromI18n(`exhibitions_perm`)
        )),
        ...(menu.dropDownButtons('menu_exhibitions_temp',
            getSectionFromI18n(`exhibitions_temp`)
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
    return buttons
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

function getNextWeekendRangeForCustom(now: Date): MyInterval {
    return getNextWeekendRange(now, '2weekends_only')
}

async function getKeyboardTime(ctx: ContextMessageUpdate) {
    const menu = new Menu(ctx, ctx.session.customize.time, ctx.session.customize.openedMenus, 'time_section')
    const weekdays = [0, 1]
        .map(i => addDays(i)(getNextWeekendRangeForCustom(startOfISOWeek(ctx.now())).start))
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

    return buttons
}

async function getMarkupKeyboard(ctx: ContextMessageUpdate) {
    return Markup.keyboard([
        [
            Markup.button(i18Btn(ctx, 'reset_filter')),
            Markup.button(i18Btn(ctx, 'show_personalized_events', {count: await countFilteredEvents(ctx)}))
        ],
        ctx.session.customize.currentStage === 'root'
            ? [Markup.button(i18SharedBtn(ctx, 'back'))]
            : [Markup.button(i18nModuleBtnName('back_to_filters'))]
    ]).resize()
}

async function getKeyboardFormat(ctx: ContextMessageUpdate): Promise<InlineKeyboardButton[][]> {
    const menu = new Menu(ctx, ctx.session.customize.format, ctx.session.customize.openedMenus, 'format_section')

    return [
        [menu.button('online')],
        [menu.button('outdoor')]
    ]
}

function resetOpenMenus(ctx: ContextMessageUpdate) {
    prepareSessionStateIfNeeded(ctx)
    ctx.session.customize.openedMenus = []
}

async function resetFilter(ctx: ContextMessageUpdate) {
    resetPaging(ctx)
    if (ctx.session.customize.currentStage === 'oblasti') {
        ctx.session.customize.oblasti = []
    } else if (ctx.session.customize.currentStage === 'priorities') {
        ctx.session.customize.cennosti = []
    } else if (ctx.session.customize.currentStage === 'time') {
        ctx.session.customize.time = []
    } else if (ctx.session.customize.currentStage === 'format') {
        ctx.session.customize.format = []
    }
}

async function showNextPortionOfResults(ctx: ContextMessageUpdate) {
    prepareSessionStateIfNeeded(ctx)

    const query = prepareRepositoryQuery(ctx)
    const events = await db.repoCustomEvents.findEventsCustomFilter({
        ...query,
        limit: limitEventsToPage,
        offset: ctx.session.paging.pagingOffset
    })

    const totalCount = await countFilteredEvents(ctx)

    let count = 1
    for (const event of events) {
        const isLastCardOnPage = count == events.length
        const isFirstCard = count == 1
        const isLastCardInTotal = ctx.session.paging.pagingOffset + count == totalCount

        const likesRow = getLikesRow(ctx, event)


        let replyMarkup = undefined
        if (isLastCardOnPage && !isLastCardInTotal) {
            replyMarkup = Markup.inlineKeyboard([likesRow, [
                Markup.callbackButton(i18Btn(ctx, 'show_more', {
                    countLeft: totalCount - ctx.session.paging.pagingOffset - count
                }), actionName('show_more'))
            ]])
        } else if (isLastCardInTotal) {
            replyMarkup = Markup.inlineKeyboard([likesRow, [
                Markup.callbackButton(i18Btn(ctx, 'back_to_filters'), actionName('last_event_back'))
            ]])
        }
        else if (isFirstCard) {
            replyMarkup = Markup.keyboard([Markup.button(i18nModuleBtnName('back_to_filters'))]).resize()
        } else {
            replyMarkup = Markup.inlineKeyboard([likesRow])
        }

        await ctx.replyWithHTML(cardFormat(event), {
                    disable_web_page_preview: true,
                    reply_markup: replyMarkup
                })

        count++
        await sleep(200)
    }

    if (events.length === 0) {
        await ctx.replyWithHTML(i18Msg(ctx, 'nothing_found', {body: getExplainFilterBody(ctx)}))
    }

    if (ctx.session.paging.pagingOffset === 0) {
        ctx.ua.pv({dp: `/customize/results/`, dt: `Подобрать под мои интересы / ${totalCount} результатов`})

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
    return generatePlural(ctx, 'event', count)
}

function isFilterEmpty(ctx: ContextMessageUpdate) {
    const customize = ctx.session.customize
    return isEmpty(customize.time) && isEmpty(customize.cennosti) && isEmpty(customize.oblasti) && isEmpty(customize.format)
}

async function getMsgForCountEvents(ctx: ContextMessageUpdate, count: number) {
    if (isFilterEmpty(ctx) && ctx.session.customize.currentStage !== 'root') {
        const tplData = {
            show_personalized_events: i18Btn(ctx, 'show_personalized_events').replace(' ', '')
        }
        switch (ctx.session.customize.currentStage) {
            case 'oblasti': return i18Msg(ctx, 'select_counter_init_oblasti', tplData)
            case 'priorities': return i18Msg(ctx, 'select_counter_init_priorities', tplData)
            case 'format': return i18Msg(ctx, 'select_counter_init_format', tplData)
            case 'time': return i18Msg(ctx, 'select_counter_init_time', tplData)
        }
    } else if (count === 0) {
        return i18Msg(ctx, 'select_counter_zero')
    } else {
        return i18Msg(ctx, 'select_counter', {eventPlural: await generateAmountSelectedPlural(ctx)})
    }
}

async function putOrRefreshCounterMessage(ctx: ContextMessageUpdate) {
    const count = await countFilteredEvents(ctx)
    const msg = await getMsgForCountEvents(ctx, count)


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
    lines = [...lines, ...formatExplainTime(ctx, i18Msg)]
    lines = [...lines, ...formatExplainOblasti(ctx, i18Msg)]
    lines = [...lines, ...formatExplainCennosti(ctx, i18Msg)]
    lines = [...lines, ...formatExplainFormat(ctx, i18Msg)]
    return lines.join('\n')
}

export async function getMsgExplainFilter(ctx: ContextMessageUpdate): Promise<string | undefined> {
    prepareSessionStateIfNeeded(ctx)

    const body = getExplainFilterBody(ctx).trim()

    if (body !== '') {
        const count = await countFilteredEvents(ctx)
        const eventPlural = generatePlural(ctx, 'event', count)
        return i18Msg(ctx, 'explain_filter.layout', {body, eventPlural})
    }
    return undefined
}

async function withSubdialog(ctx: ContextMessageUpdate, subStage: StageType, callback: () => Promise<void>) {
    ctx.session.customize.currentStage = subStage
    prepareSessionStateIfNeeded(ctx)
    resetOpenMenus(ctx)
    resetBottomMessageWithNumberOfEventsFound(ctx)

    await callback()
    // await ctx.replyWithHTML(i18Msg(ctx, 'select_finger_up'), Extra.markup((await getMarkupKeyboard(ctx))))
    //
    // await putOrRefreshCounterMessage(ctx)
}

export async function editMessageAndButtons(ctx: ContextMessageUpdate, inlineButtons: InlineKeyboardButton[][], text: string) {
    const markup: InlineKeyboardMarkup = {
        inline_keyboard: inlineButtons
    };
    const goodErrors = [
        `Telegraf: "editMessageText" isn't available for "message::text"`,
        `Telegraf: "editMessageReplyMarkup" isn't available for "message::text"`,
    ]
    try {
        // if (ctx.session.lastText !== text) {
        await ctx.editMessageText(text, {
            parse_mode: 'HTML',
            reply_markup: markup
        })
        // }

    } catch (e) {
        if (goodErrors.includes(e.message)) {
            await ctx.replyWithHTML(text, {
                reply_markup: markup
            })
        } else {
            throw e
        }
    }
    // ctx.session.lastText = text
}

async function updateDialog(ctx: ContextMessageUpdate, subStage: StageType) {

    function navRow() {
        return [Markup.callbackButton('---', actionName('---'))]
    }

    async function btnRow(btn1: string, btn2: string, selected: any[]): Promise<InlineKeyboardButton[]> {

        function removeEmoji(str: string) {
            return str.replace(emojiRegex(), '').trim()
        }

        let btn2Text
        if (btn2 !== 'show_personalized_events') {
            btn2Text = i18Btn(ctx, 'forward_icon', {btn: removeEmoji(i18Btn(ctx, 'next', {eventPlural: await generateAmountSelectedPlural(ctx)}))})
        } else {
            btn2Text = i18Btn(ctx, 'show_personalized_events', {eventPlural: await generateAmountSelectedPlural(ctx)})
        }
        return [
            Markup.callbackButton(btn1 === 'up' ? i18Btn(ctx, 'up') : i18Btn(ctx, 'back'), actionName(btn1)),
            Markup.callbackButton(btn2Text, actionName(btn2)),
        ]

        //
        // return btns.map(btnType => {
        //     switch (btnType) {
        //         case 'back':
        //             return Markup.callbackButton(i18Btn(ctx, 'back'), actionName('back_to_filters'))
        //         case 'reset':
        //             return Markup.callbackButton(i18Btn(ctx, 'reset_filter'), actionName('reset_filter'))
        //         default:
        //             return Markup.callbackButton(i18Btn(ctx, `go_${btnType}`), actionName(btnType))
        //     }
        // })
    }

    const kbs: Record<StageType, () => Promise<InlineKeyboardButton[][]>> = {
        root: undefined,
        format: async () => [...await getKeyboardFormat(ctx), await btnRow('up', 'oblasti', ctx.session.customize.format)],
        oblasti: async () => [...await getKeyboardOblasti(ctx), await btnRow('format', 'priorities', ctx.session.customize.oblasti)],
        priorities: async () => [...await getKeyboardCennosti(ctx), await btnRow('oblasti', 'time', ctx.session.customize.cennosti)],
        time: async () => [...await getKeyboardTime(ctx), await btnRow('customize', 'show_personalized_events', ctx.session.customize.time)],
    }

    const inlineButtons =
        [
            ...await kbs[subStage]()
        ]

    const msg = await getMsgExplainFilter(ctx)
    // const msg = i18Msg(ctx, `select_${subStage}`)
    return await editMessageAndButtons(ctx, inlineButtons, msg ?? i18Msg(ctx, `select_${subStage}`))
}

function postStageActionsFn(bot: Composer<ContextMessageUpdate>) {
    bot
        .action(actionName('oblasti'), async (ctx: ContextMessageUpdate) => {
            await ctx.answerCbQuery()
            await withSubdialog(ctx, 'oblasti', async () => {
                await updateDialog(ctx, 'oblasti')
                ctx.ua.pv({dp: `/customize/rubrics/`, dt: `Подобрать под мои интересы > Рубрики`})
            })

        })
        .action(actionName('priorities'), async (ctx: ContextMessageUpdate) => {
            await ctx.answerCbQuery()
            await withSubdialog(ctx, 'priorities', async () => {
                await updateDialog(ctx, 'priorities')
                ctx.ua.pv({dp: `/customize/priorities/`, dt: `Подобрать под мои интересы > Приоритеты`})
            })

        })
        .action(actionName('time'), async (ctx: ContextMessageUpdate) => {
            await ctx.answerCbQuery()
            await withSubdialog(ctx, 'time', async () => {
                await updateDialog(ctx, 'time')
                ctx.ua.pv({dp: `/customize/time/`, dt: `Подобрать под мои интересы > Время`})
            })

        })
        .action(actionName('format'), async (ctx: ContextMessageUpdate) => {
            await ctx.answerCbQuery()
            await withSubdialog(ctx, 'format', async () => {
                await updateDialog(ctx, 'format')
                ctx.ua.pv({dp: `/customize/format/`, dt: `Подобрать под мои интересы > Формат`})
            })
        })
        .action(actionName('show_personalized_events'), async (ctx: ContextMessageUpdate) => {
            await warnAdminIfDateIsOverriden(ctx)
            await showNextPortionOfResults(ctx)
        })
        .action(actionName('reset_filter'), async (ctx: ContextMessageUpdate) => {
            await resetFilter(ctx)
            await goBackToCustomize(ctx)
        })
        .action(actionName('back_to_filters'), async (ctx: ContextMessageUpdate) => {
            await ctx.answerCbQuery()
            await goBackToCustomize(ctx)
        })
}

async function goBackToCustomize(ctx: ContextMessageUpdate) {
    prepareSessionStateIfNeeded(ctx)
    const explainMsg = await getMsgExplainFilter(ctx)
    const msg = explainMsg ?? undefined
    ctx.session.customize.currentStage = 'root'
    await showMainMenu(ctx, msg)
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

async function checkOrUncheckMenuState(ctx: ContextMessageUpdate) {
    await ctx.answerCbQuery()
    const menuTitle = ctx.match[1]
    if (ctx.session.customize.openedMenus.includes(menuTitle)) {
        ctx.session.customize.openedMenus = []
    } else {
        ctx.session.customize.openedMenus = [menuTitle]
    }
}


async function showMainMenu(ctx: ContextMessageUpdate, text = i18Msg(ctx, 'welcome')) {
    await ctx.replyWithHTML(text, Extra.markup(Markup.inlineKeyboard(await getFilterMainButtons(ctx))))

    ctx.ua.pv({dp: `/customize/`, dt: `Подобрать под мои интересы`})
}

async function answerCbEventsSelected(ctx: ContextMessageUpdate) {
    const count = await countFilteredEvents(ctx)

    if (count > 0) {
        await ctx.answerCbQuery(i18Msg(ctx, 'popup_selected',
            {eventPlural: generatePlural(ctx, 'event', count)}))
    } else {
        await ctx.answerCbQuery(i18Msg(ctx, 'popup_zero_selected'))
    }
}

scene
    .enter(async (ctx: ContextMessageUpdate) => {
        prepareSessionStateIfNeeded(ctx)

        await ctx.replyWithHTML(i18Msg(ctx, 'header'), Extra.markup(Markup.keyboard([i18Btn(ctx, 'back')]).resize()))
        await showMainMenu(ctx)
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
        await checkOrUncheckMenuState(ctx)
        await updateDialog(ctx, 'priorities')
    })
    .action(/customize_scene[.]o_(menu_.+)/, async (ctx: ContextMessageUpdate) => {
        await checkOrUncheckMenuState(ctx)
        await updateDialog(ctx, 'oblasti')
    })
    .action(/customize_scene[.]t_(menu_.+)/, async (ctx: ContextMessageUpdate) => {
        await checkOrUncheckMenuState(ctx)
        await updateDialog(ctx, 'time')
    })
    .action(/customize_scene[.]p_(.+)/, async (ctx: ContextMessageUpdate) => {
        cennostiOptionLogic(ctx, ctx.match[1])
        resetPaging(ctx)
        await answerCbEventsSelected(ctx)
        await updateDialog(ctx, 'priorities')
    })
    .action(/customize_scene[.]o_(.+)/, async (ctx: ContextMessageUpdate) => {
        oblastiOptionLogic(ctx, ctx.match[1])
        resetPaging(ctx)
        await answerCbEventsSelected(ctx)
        await updateDialog(ctx, 'oblasti')
    })
    .action(/customize_scene[.]t_(.+)/, async (ctx: ContextMessageUpdate) => {
        timeOptionLogic(ctx, ctx.match[1])
        resetPaging(ctx)

        await answerCbEventsSelected(ctx)
        await updateDialog(ctx, 'time')
    })
    .action(/customize_scene[.]f_(.+)/, async (ctx: ContextMessageUpdate) => {
        formatOptionLogic(ctx, ctx.match[1])
        resetPaging(ctx)

        await answerCbEventsSelected(ctx)
        await updateDialog(ctx, 'format')
        // await putOrRefreshCounterMessage(ctx)
    })
    .action(actionName('dummy'), async (ctx: ContextMessageUpdate) => {
        await ctx.answerCbQuery('Чтобы увидеть события, пройдите к следующему фильтру')
    })
    .action(actionName('last_event_back'), async (ctx: ContextMessageUpdate) => {
        await ctx.answerCbQuery()
        await resetSessionIfProblem(ctx, async () => {
            prepareSessionStateIfNeeded(ctx)
            await goBackToCustomize(ctx)
        })
    })
    .hears(i18nModuleBtnName('back'), async (ctx: ContextMessageUpdate) => {
        await resetSessionIfProblem(ctx, async () => {
            prepareSessionStateIfNeeded(ctx)
            if (ctx.session.customize.currentStage === 'root') {
                await ctx.scene.enter('main_scene')
            } else {
                await goBackToCustomize(ctx)
            }
        })
    })


async function resetSessionIfProblem(ctx: ContextMessageUpdate, callback: () => Promise<void>) {
    try {
        await callback()
    } catch (e) {
        ctx.session.customize = undefined
        await saveSession(ctx)
        throw e
    }
}


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
        currentStage: currentStage || 'root',
        resultsFound: SessionEnforcer.number(resultsFound),

        eventsCounterMsgId: SessionEnforcer.number(eventsCounterMsgId),
    }
}

export const customizeScene = {
    scene,
    postStageActionsFn
} as SceneRegister

type StageType = 'root' | 'time' | 'oblasti' | 'priorities' | 'format'

export interface CustomizeSceneState {
    time: string[]
    openedMenus: string[]
    cennosti: TagLevel2[]
    oblasti: string[]
    format: string[]
    eventsCounterMsgId?: number
    eventsCounterMsgText: string
    resultsFound: number
    currentStage: StageType
}
