import { BaseScene, Composer, Extra, Markup } from 'telegraf'
import { ContextMessageUpdate, TagLevel2 } from '../../interfaces/app-interfaces'
import { i18nSceneHelper } from '../../util/scene-helper'
import { CallbackButton, InlineKeyboardButton } from 'telegraf/typings/markup'
import {
    editMessageAndButtons,
    generatePlural,
    replyWithBackToMainMarkup,
    UpdatableMessageState
} from '../shared/shared-logic'
import { formatExplainCennosti, formatExplainFormat, formatExplainOblasti, formatExplainTime } from './format-explain'
import { resetSessionIfProblem } from './customize-utils'
import { db } from '../../database/db'
import { Paging } from '../shared/paging'
import { SceneRegister } from '../../middleware-utils'
import { isEmpty } from 'lodash'
import emojiRegex from 'emoji-regex'
import { prepareRepositoryQuery, prepareSessionStateIfNeeded } from './customize-common'
import { cennostiOptionLogic, customizeCennosti } from './filters/customize-cennosti'
import { customizeOblasti, oblastiOptionLogic } from './filters/customize-oblasti'
import { getKeyboardTime, timeOptionLogic } from './filters/customize-time'
import { formatOptionLogic, getKeyboardFormat } from './filters/customize-format'
import { EventsSlider } from '../shared/events-slider'
import { CustomizeSliderConfig } from './customize-slider-config'

const scene = new BaseScene<ContextMessageUpdate>('customize_scene')

const {backButton, actionName, i18nModuleBtnName, revertActionName, scanKeys, i18nSharedBtnName, i18Btn, i18Msg, i18SharedBtn} = i18nSceneHelper(scene)

export interface CustomizeSceneState extends UpdatableMessageState {
    time: string[]
    cennosti: TagLevel2[]
    oblasti: string[]
    format: string[]
    openedMenus: string[]
    eventsCounterMsgId?: number
    eventsCounterMsgText: string
    resultsFound: number
    currentStage: StageType
    prevStage?: StageType

    filteredEventsSnapshot?: number[]
}

const eventSlider = new EventsSlider(new CustomizeSliderConfig())

async function countFilteredEvents(ctx: ContextMessageUpdate) {
    if (ctx.session.customize.resultsFound === undefined) {
        const query = prepareRepositoryQuery(ctx)
        ctx.session.customize.resultsFound = await db.repoCustomEvents.countEventsCustomFilter(query)
    }
    return ctx.session.customize.resultsFound;
}

async function showFilteredEventsButton(ctx: ContextMessageUpdate) {
    return Markup.callbackButton(i18Btn(ctx, 'show_personalized_events', {
        count: await countFilteredEvents(ctx)
    }), actionName('show_personalized_events'))
}

const getMainKeyboard = async (ctx: ContextMessageUpdate): Promise<CallbackButton[][]> => {
    const selected = i18Btn(ctx, 'selected_filter_postfix')

    function btn(name: string, state: string[]): CallbackButton {
        return Markup.callbackButton(i18Btn(ctx, name) + (isEmpty(state) ? '' : ' ' + selected), actionName(name))
    }

    return [
        [btn('oblasti', ctx.session.customize.oblasti), btn('priorities', ctx.session.customize.cennosti)],
        [btn('time', ctx.session.customize.time), btn('format', ctx.session.customize.format)],
        [await showFilteredEventsButton(ctx)],
    ]
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

function resetOpenMenus(ctx: ContextMessageUpdate) {
    prepareSessionStateIfNeeded(ctx)
    ctx.session.customize.openedMenus = []
}

async function resetFilter(ctx: ContextMessageUpdate) {
    resetPaging(ctx)
    const state = ctx.session.customize
    if (state.currentStage === 'oblasti') {
        state.oblasti = []
    } else if (state.currentStage === 'priorities') {
        state.cennosti = []
    } else if (state.currentStage === 'time') {
        state.time = []
    } else if (state.currentStage === 'format') {
        state.format = []
    }
}

async function generateAmountSelectedPlural(ctx: ContextMessageUpdate) {
    const count = await countFilteredEvents(ctx)
    return generatePlural(ctx, 'event', count)
}

// function isFilterEmpty(ctx: ContextMessageUpdate) {
//     const customize = ctx.session.customize
//     return isEmpty(customize.time) && isEmpty(customize.cennosti) && isEmpty(customize.oblasti) && isEmpty(customize.format)
// }

// async function getMsgForCountEvents(ctx: ContextMessageUpdate, count: number) {
//     if (isFilterEmpty(ctx) && ctx.session.customize.currentStage !== 'root') {
//         const tplData = {
//             show_personalized_events: i18Btn(ctx, 'show_personalized_events', {count: 0}).replace(' ', '')
//         }
//         switch (ctx.session.customize.currentStage) {
//             case 'oblasti': return i18Msg(ctx, 'select_counter_init_oblasti', tplData)
//             case 'priorities':
//                 return i18Msg(ctx, 'select_counter_init_priorities', tplData)
//             case 'format':
//                 return i18Msg(ctx, 'select_counter_init_format', tplData)
//             case 'time':
//                 return i18Msg(ctx, 'select_counter_init_time', tplData)
//         }
//     } else if (count === 0) {
//         return i18Msg(ctx, 'select_counter_zero')
//     } else {
//         return i18Msg(ctx, 'select_counter', {eventPlural: await generateAmountSelectedPlural(ctx)})
//     }
// }

// Уберите условия с других фильтров, или добавьте
function resetBottomMessageWithNumberOfEventsFound(ctx: ContextMessageUpdate) {
    ctx.session.customize.eventsCounterMsgText = undefined
    ctx.session.customize.eventsCounterMsgId = undefined
}

function getExplainFilterBody(ctx: ContextMessageUpdate): string {
    let lines: string[] = []
    lines = [...lines, ...formatExplainFormat(ctx, i18Msg)]
    lines = [...lines, ...formatExplainOblasti(ctx, i18Msg)]
    lines = [...lines, ...formatExplainCennosti(ctx, i18Msg)]
    lines = [...lines, ...formatExplainTime(ctx, i18Msg)]
    return lines.join('\n')
}

export async function getMsgExplainFilter(ctx: ContextMessageUpdate, layoutId: 'layout' | 'layout_step'): Promise<string | undefined> {
    prepareSessionStateIfNeeded(ctx)

    const body = getExplainFilterBody(ctx).trim()

    if (body !== '') {
        const count = await countFilteredEvents(ctx)
        const eventPlural = generatePlural(ctx, 'event', count)
        return i18Msg(ctx, 'explain_filter.' + layoutId, {body, eventPlural})
    }
    return undefined
}

async function withSubdialog(ctx: ContextMessageUpdate, subStage: StageType, callback: () => Promise<void>) {
    prepareSessionStateIfNeeded(ctx)
    ctx.session.customize.currentStage = subStage
    resetOpenMenus(ctx)
    resetBottomMessageWithNumberOfEventsFound(ctx)

    await callback()
}

async function getFilterPageMsg(ctx: ContextMessageUpdate, subStage: 'root' | 'time' | 'oblasti' | 'priorities' | 'format' | 'results') {
    const explain = await getMsgExplainFilter(ctx, 'layout_step')
    const msgOnFilterPages = i18Msg(ctx, `select_${subStage}`, {
        explain: explain ? `\n\n${explain}` : ''
    })
    return msgOnFilterPages
}

async function showGoToResultsButton(ctx: ContextMessageUpdate) {
    const count = await countFilteredEvents(ctx)
    return i18Btn(ctx, count > 0 ? 'show_personalized_events' : 'show_personalized_events_zero', {
        count
    })
}

async function updateDialog(ctx: ContextMessageUpdate, subStage: StageType) {
    async function btnRow(btn1: string, btn2: string, selected: any[]): Promise<InlineKeyboardButton[]> {

        function removeEmoji(str: string) {
            return str.replace(emojiRegex(), '').trim()
        }

        // let btn2Text
        // if (btn2 !== 'show_personalized_events') {
        //     btn2Text = i18Btn(ctx, 'forward_icon', {btn: removeEmoji(i18Btn(ctx, 'next', {eventPlural: await generateAmountSelectedPlural(ctx)}))})
        // } else {
        //     btn2Text = i18Btn(ctx, 'show_personalized_events', {eventPlural: await generateAmountSelectedPlural(ctx)})
        // }
        return [
            Markup.callbackButton(i18Btn(ctx, 'back_to_filters'), actionName('back_to_filters')),
            Markup.callbackButton(await showGoToResultsButton(ctx), actionName('show_personalized_events'))
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

    if (subStage === 'results') {
        await eventSlider.initialShowCards(ctx)
        return
    }

    const kbs: Record<StageType, () => Promise<InlineKeyboardButton[][]>> = {
        results: undefined,
        root: async () => await getMainKeyboard(ctx),
        format: async () => [...await getKeyboardFormat(ctx), await btnRow('back_to_filters', 'oblasti', ctx.session.customize.format)],
        oblasti: async () => [...await customizeOblasti(ctx), await btnRow('format', 'priorities', ctx.session.customize.oblasti)],
        priorities: async () => [...await customizeCennosti(ctx), await btnRow('oblasti', 'time', ctx.session.customize.cennosti)],
        time: async () => [...await getKeyboardTime(ctx), await btnRow('priorities', 'show_personalized_events', ctx.session.customize.time)],
    }

    if (kbs[subStage] === undefined) {
        throw new Error(`kbs[${subStage}] not exists`)
    }

    const inlineButtons =
        [
            ...await kbs[subStage]()
        ]

    // const msg = i18Msg(ctx, `select_${subStage}`)
    let msg: string
    if (subStage === 'root') {
        msg = i18Msg(ctx, 'welcome')
    } else {
        msg = await getFilterPageMsg(ctx, subStage)
    }
    return await editMessageAndButtons(ctx, inlineButtons, msg)
}

async function goBackToCustomize(ctx: ContextMessageUpdate) {
    prepareSessionStateIfNeeded(ctx)
    const explainMsg = await getMsgExplainFilter(ctx, 'layout')
    const msg = explainMsg ?? undefined
    ctx.session.customize.currentStage = 'root'
    await showMainMenu(ctx, msg)
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
    await ctx.replyWithHTML(text, Extra.markup(Markup.inlineKeyboard(await getMainKeyboard(ctx))))

    ctx.ua.pv({dp: `/customize/`, dt: `Подобрать под мои интересы`})
}


async function answerCbEventsSelected(ctx: ContextMessageUpdate) {
    const count = await countFilteredEvents(ctx)
    await ctx.answerCbQuery(i18Msg(ctx, count > 0 ? 'popup_selected' : 'popup_zero_selected',
        {eventPlural: generatePlural(ctx, 'event', count)}))
}

scene
    .enter(async (ctx: ContextMessageUpdate) => {
        prepareSessionStateIfNeeded(ctx)

        await replyWithBackToMainMarkup(ctx)
        await updateDialog(ctx, 'root')
    })
    .leave((ctx: ContextMessageUpdate) => {
        ctx.session.customize = undefined
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

function postStageActionsFn(bot: Composer<ContextMessageUpdate>) {
    bot
        .use(eventSlider.middleware())
        .action(actionName('format'), async (ctx: ContextMessageUpdate) => {
            await ctx.answerCbQuery()
            await withSubdialog(ctx, 'format', async () => {
                await updateDialog(ctx, 'format')
                ctx.ua.pv({dp: `/customize/format/`, dt: `Подобрать под мои интересы > Формат`})
            })
        })
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
        .action(actionName('show_personalized_events'), async (ctx: ContextMessageUpdate) => {
            prepareSessionStateIfNeeded(ctx)
            if (await countFilteredEvents(ctx) === 0) {
                await ctx.answerCbQuery(i18Msg(ctx, 'cb_show_personalized_events'))
            } else {
                await ctx.answerCbQuery()
                ctx.session.customize.prevStage = ctx.session.customize.currentStage
                ctx.session.customize.currentStage = 'results'
                await updateDialog(ctx, 'results')
            }
        })
        .action(actionName('show_filtered_events'), async (ctx: ContextMessageUpdate) => {
            await ctx.answerCbQuery()
            await updateDialog(ctx, 'results')
        })
        .action(actionName('event_back'), async (ctx: ContextMessageUpdate) => {
            await ctx.answerCbQuery()
            prepareSessionStateIfNeeded(ctx)
            if (ctx.session.customize.prevStage !== undefined) {
                await withSubdialog(ctx, ctx.session.customize.prevStage, async () => {
                    await updateDialog(ctx, ctx.session.customize.prevStage)
                    // ctx.ua.pv({dp: `/customize/time/`, dt: `Подобрать под мои интересы > Время`})
                })
            } else {
                await goBackToCustomize(ctx)
            }
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


function resetPaging(ctx: ContextMessageUpdate) {
    prepareSessionStateIfNeeded(ctx)
    Paging.reset(ctx)
    ctx.session.customize.resultsFound = undefined;
}

export const customizeScene = {
    scene,
    postStageActionsFn
} as SceneRegister

type StageType = 'root' | 'time' | 'oblasti' | 'priorities' | 'format' | 'results'