import { Composer, Markup, Scenes } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { i18nSceneHelper } from '../../util/scene-helper'
import {
    editMessageAndButtons,
    EditMessageAndButtonsOptions,
    generatePlural,
    getMsgId,
    replyWithBackToMainMarkup
} from '../shared/shared-logic'
import { formatExplainPriorities, formatExplainRubrics } from './format-explain'
import { resetSessionIfProblem } from './customize-utils'
import { SceneRegister } from '../../middleware-utils'
import { isEmpty } from 'lodash'
import { prepareRepositoryQuery, prepareSessionStateIfNeeded, StageType } from './customize-common'
import { customizepriorities, prioritiesOptionLogic } from './filters/customize-priorities'
import { customizeRubrics, rubricsOptionLogic } from './filters/customize-rubrics'
import { formatExplainTime, getKeyboardTime, timeOptionLogic } from './filters/customize-time'
import { formatExplainFormat, formatOptionLogic, getKeyboardFormat } from './filters/customize-format'
import { SliderPager } from '../shared/slider-pager'
import { CustomizePagerConfig } from './customize-pager-config'
import { db } from '../../database/db'
import { InlineKeyboardButton } from 'telegraf/typings/telegram-types'

const scene = new Scenes.BaseScene<ContextMessageUpdate>('customize_scene')

const {backButton, actionName, i18Btn, i18Msg} = i18nSceneHelper(scene)

const eventSlider = new SliderPager(new CustomizePagerConfig())

async function showFilteredEventsButton(ctx: ContextMessageUpdate) {

    return Markup.button.callback(i18Btn(ctx,
        await countFoundEvents(ctx) > 0 ? 'show_personalized_events' : 'show_personalized_events_zero', {
            count: await countFoundEvents(ctx)
        }), actionName('show_personalized_events'))
}

function isAnyFilterSelected(ctx: ContextMessageUpdate): boolean {
    const state = ctx.session.customize
    return (state.format.length + state.rubrics.length + state.priorities.length + state.time.length) > 0
}

function resetButton(ctx: ContextMessageUpdate) {
    return Markup.button.callback(i18Btn(ctx, 'reset_filter'), actionName('reset_filter'))
}

const getRootKeyboard = async (ctx: ContextMessageUpdate): Promise<InlineKeyboardButton.CallbackButton[][]> => {
    const selected = i18Btn(ctx, 'selected_filter_postfix')

    function btn(name: string, state: string[]): InlineKeyboardButton.CallbackButton {
        return Markup.button.callback(i18Btn(ctx, name) + (isEmpty(state) ? '' : ' ' + selected), actionName(name))
    }

    const showEventsBtn = await showFilteredEventsButton(ctx)
    return [
        [btn('format', ctx.session.customize.format), btn('rubrics', ctx.session.customize.rubrics)],
        [btn('priorities', ctx.session.customize.priorities), btn('time', ctx.session.customize.time)],
        ...(isAnyFilterSelected(ctx) ? [[resetButton(ctx)]] : []),
        [...(isAnyFilterSelected(ctx) ? [backButton(), showEventsBtn] : [backButton()])],
    ]
}

function resetOpenMenus(ctx: ContextMessageUpdate) {
    prepareSessionStateIfNeeded(ctx)
    ctx.session.customize.openedMenus = []
}

function resetFilter(ctx: ContextMessageUpdate) {
    prepareSessionStateIfNeeded(ctx)
    const state = ctx.session.customize
    state.rubrics = []
    state.priorities = []
    state.time = []
    state.format = []
}


function getExplainFilterBody(ctx: ContextMessageUpdate): string {
    let lines: string[] = []
    const offset = '<code> </code>'

    function prepareLine(strings: string[]) {
        return strings.map(s => `${offset}${s}`).join(`\n`)
    }

    lines = [
        prepareLine(formatExplainFormat(ctx, i18Msg)),
        prepareLine(formatExplainRubrics(ctx, i18Msg)),
        prepareLine(formatExplainPriorities(ctx, i18Msg)),
        prepareLine(formatExplainTime(ctx, i18Msg))
    ].filter(s => s !== '')

    return lines.join(`\n${offset} +\n`)
}

export async function getMsgExplainFilter(ctx: ContextMessageUpdate, layoutId: 'layout' | 'layout_step'): Promise<string | undefined> {
    prepareSessionStateIfNeeded(ctx)

    const body = getExplainFilterBody(ctx)

    if (body !== '') {
        const count = await countFoundEvents(ctx)
        const eventPlural = generatePlural(ctx, 'event', count)
        return i18Msg(ctx, 'explain_filter.' + layoutId, {body, eventPlural})
    }
    return undefined
}

async function withSubDialog(ctx: ContextMessageUpdate, subStage: StageType) {
    prepareSessionStateIfNeeded(ctx)
    resetOpenMenus(ctx)
    await updateDialog(ctx, subStage)
}

async function showGoToResultsButton(ctx: ContextMessageUpdate) {
    const count = await countFoundEvents(ctx)
    return i18Btn(ctx, count > 0 ? 'show_personalized_events' : 'show_personalized_events_zero', {
        count
    })
}


interface UpdateDialogOptions extends EditMessageAndButtonsOptions {
    restoreMessage?: boolean
}

async function updateDialog(ctx: ContextMessageUpdate, subStage: StageType, options: UpdateDialogOptions = {
    forceNewMsg: false,
    restoreMessage: false
}) {
    ctx.session.customize.prevStage = ctx.session.customize.currentStage
    ctx.session.customize.currentStage = subStage

    async function btnRow(): Promise<InlineKeyboardButton[]> {
        return [
            Markup.button.callback(i18Btn(ctx, 'back'), actionName('back_to_filters')),
            Markup.button.callback(await showGoToResultsButton(ctx), actionName('show_personalized_events'))
        ]
    }

    if (subStage === 'results') {
        return await eventSlider.showOrUpdateSlider(ctx)
    }

    const kbs: Record<StageType, () => Promise<InlineKeyboardButton[][]>> = {
        results: undefined,
        root: async () => await getRootKeyboard(ctx),
        format: async () => [...await getKeyboardFormat(ctx), await btnRow()],
        rubrics: async () => [...await customizeRubrics(ctx), await btnRow()],
        priorities: async () => [...await customizepriorities(ctx), await btnRow()],
        time: async () => [...await getKeyboardTime(ctx), await btnRow()],
    }

    if (kbs[subStage] === undefined) {
        throw new Error(`kbs[${subStage}] not exists`)
    }

    const inlineButtons =
        [
            ...await kbs[subStage]()
        ]

    let msg: string
    if (subStage === 'root') {

        if (isAnyFilterSelected(ctx)) {
            const count = await countFoundEvents(ctx)
            msg = i18Msg(ctx, count > 0 ? 'welcome_with_filter' : 'welcome_with_filter_zero', {
                explain: getExplainFilterBody(ctx),
                eventPlural: generatePlural(ctx, 'event', count)
            })

            if (options.restoreMessage === true) {
                msg = `${i18Msg(ctx, 'old_filter_loaded', {
                    resetBtn: i18Btn(ctx, 'reset_filter')
                })}\n\n${msg}`
            }

        } else {
            msg = i18Msg(ctx, 'welcome_empty')
        }
    } else {
        msg = await i18Msg(ctx, isAnyFilterSelected(ctx) ? `select_layout` : `select_layout_empty`, {
            text: i18Msg(ctx, `select_text_${subStage}`),
            explain: await getMsgExplainFilter(ctx, 'layout_step')
        })
    }
    const msgId = await editMessageAndButtons(ctx, inlineButtons, msg, options)
    return msgId
}

// async function goBackToCustomize(ctx: ContextMessageUpdate) {
//     prepareSessionStateIfNeeded(ctx)
//     await updateDialog(ctx, 'root')
// }

async function checkOrUncheckMenuState(ctx: ContextMessageUpdate & { match: RegExpExecArray }) {
    await ctx.answerCbQuery()
    const menuTitle = ctx.match[1]
    if (ctx.session.customize.openedMenus.includes(menuTitle)) {
        ctx.session.customize.openedMenus = []
    } else {
        ctx.session.customize.openedMenus = [menuTitle]
    }
}

async function invalidateSliderAndCounters(ctx: ContextMessageUpdate, msgId: number = undefined) {
    ctx.session.customize.resultsFound = undefined
    const {format, rubrics, priorities, time} = ctx.session.customize
    const state = {format, rubrics, priorities, time}
    await eventSlider.updateState(ctx, {
        state,
        total: await countFoundEvents(ctx),
        msgId: msgId ?? getMsgId(ctx)
    })
}

async function countFoundEvents(ctx: ContextMessageUpdate) {
    if (ctx.session.customize.resultsFound === undefined) {
        return await db.repoCustomEvents.countEventsCustomFilter({
            ...prepareRepositoryQuery(ctx, ctx.session.customize),
        })
    }
    return ctx.session.customize.resultsFound
}

// async function showMainMenu(ctx: ContextMessageUpdate, text = i18Msg(ctx, 'welcome')) {
//     await ctx.replyWithHTML(text, Extra.markup(Markup.inlineKeyboard(await getMainKeyboard(ctx).reply_markup)))
//
//     ctx.ua.pv({dp: `/customize/`, dt: `Подобрать под мои интересы`})
// }
//

async function answerCbEventsSelected(ctx: ContextMessageUpdate) {
    const count = await countFoundEvents(ctx)
    await ctx.answerCbQuery(i18Msg(ctx, count > 0 ? 'popup_selected' : 'popup_zero_selected',
        {eventPlural: generatePlural(ctx, 'event', count)}))
}


function isThisMessageMatchesWithActiveFilter(ctx: ContextMessageUpdate) {
    const activeSlider = eventSlider.getActiveSliderState(ctx)
    return activeSlider && activeSlider.msgId === getMsgId(ctx)
}

scene
    .enter(async ctx => {
        prepareSessionStateIfNeeded(ctx)
        await replyWithBackToMainMarkup(ctx, i18Msg(ctx, 'markup_back_decoy'))
        ctx.session.customize.resultsFound = undefined
        const msgId = await updateDialog(ctx, 'root', {forceNewMsg: true, restoreMessage: true})
        await invalidateSliderAndCounters(ctx, msgId)
    })
    .leave((ctx: ContextMessageUpdate) => {
        ctx.session.customize = undefined
        // resetFilter(ctx)
        // ctx.session.customize.currentStage = 'root'
    })
    .action(/customize_scene[.]p_(menu_.+)/, async ctx => {
        prepareSessionStateIfNeeded(ctx)
        await checkOrUncheckMenuState(ctx)
        await updateDialog(ctx, 'priorities')
    })
    .action(/customize_scene[.]o_(menu_.+)/, async ctx => {
        prepareSessionStateIfNeeded(ctx)
        await checkOrUncheckMenuState(ctx)
        await updateDialog(ctx, 'rubrics')
    })
    .action(/customize_scene[.]t_(menu_.+)/, async ctx => {
        prepareSessionStateIfNeeded(ctx)
        await checkOrUncheckMenuState(ctx)
        await updateDialog(ctx, 'time')
    })
    .action(/customize_scene[.]p_(.+)/, async ctx => {
        prepareSessionStateIfNeeded(ctx)
        prioritiesOptionLogic(ctx, ctx.match[1])
        await invalidateSliderAndCounters(ctx)
        await answerCbEventsSelected(ctx)
        await updateDialog(ctx, 'priorities')
    })
    .action(/customize_scene[.]o_(.+)/, async ctx => {
        prepareSessionStateIfNeeded(ctx)
        rubricsOptionLogic(ctx, ctx.match[1])
        await invalidateSliderAndCounters(ctx)
        await answerCbEventsSelected(ctx)
        await updateDialog(ctx, 'rubrics')
    })
    .action(/customize_scene[.]t_(.+)/, async ctx => {
        prepareSessionStateIfNeeded(ctx)
        timeOptionLogic(ctx, ctx.match[1])
        await invalidateSliderAndCounters(ctx)

        await answerCbEventsSelected(ctx)
        await updateDialog(ctx, 'time')
    })
    .action(/customize_scene[.]f_(.+)/, async ctx => {
        prepareSessionStateIfNeeded(ctx)
        formatOptionLogic(ctx, ctx.match[1])
        await invalidateSliderAndCounters(ctx)

        await answerCbEventsSelected(ctx)
        await updateDialog(ctx, 'format')
    })
    .action(actionName('last_card_back'), async ctx => {
        await ctx.answerCbQuery()
        await resetSessionIfProblem(ctx, async () => {
            prepareSessionStateIfNeeded(ctx)
            await updateDialog(ctx, 'root')
        })
    })
    .action(actionName('card_back'), async ctx => {
        await ctx.answerCbQuery()
        prepareSessionStateIfNeeded(ctx)

        if (isThisMessageMatchesWithActiveFilter(ctx)) {
            if (ctx.session.customize.prevStage !== undefined) {
                await updateDialog(ctx, ctx.session.customize.prevStage)
            } else {
                await updateDialog(ctx, 'root')
            }
        } else {
            await restoreOldCustomize(ctx)
        }
    })
// .hears(i18nModuleBtnName('back'), async ctx => {
//     await resetSessionIfProblem(ctx, async () => {
//         prepareSessionStateIfNeeded(ctx)
//         await ctx.scene.enter('main_scene')
//         // if (ctx.session.customize.currentStage === 'root') {
//         //     await ctx.scene.enter('main_scene')
//         // } else {
//         //     const newMsgId = await updateDialog(ctx, 'root', {forceNewMsg: true})
//         //     eventSlider.cloneActiveStateWithNewMsgId(ctx, newMsgId)
//         // }
//     })
// })

async function editMessageNotifyUserItsOld(ctx: ContextMessageUpdate) {
    // await editMessageAndButtons(ctx, [], i18Msg(ctx, 'message_is_old'))
    ctx.logger.warn(`message msg=${getMsgId(ctx)} is old`)
    await ctx.scene.enter('main_scene')
}

async function editMessageNotifyUserViewBelow(ctx: ContextMessageUpdate) {
    await editMessageAndButtons(ctx, [], i18Msg(ctx, 'filter_is_old_scroll_down'))
}

async function restoreOldCustomize(ctx: ContextMessageUpdate) {
    const restoreState = eventSlider.tryRestoreStateFromMsg(ctx)
    if (restoreState === undefined) {
        await editMessageNotifyUserItsOld(ctx)
    } else {
        await editMessageNotifyUserViewBelow(ctx)

        ctx.session.customize = {...ctx.session.customize, ...restoreState}
        await ctx.scene.enter(scene.id, {}, true)
        const msgId = await updateDialog(ctx, 'root', {restoreMessage: true, forceNewMsg: true})
        await eventSlider.updateState(ctx, {
            state: restoreState,
            total: await countFoundEvents(ctx),
            msgId
        })
    }
}

function postStageActionsFn(bot: Composer<ContextMessageUpdate>): void {
    bot
        .use(eventSlider.middleware())
        .action(actionName('format'), async ctx => {
            await ctx.answerCbQuery()
            await withSubDialog(ctx, 'format')
            ctx.ua.pv({dp: `/customize/format/`, dt: `Подобрать под интересы > Формат`})
        })
        .action(actionName('rubrics'), async ctx => {
            await ctx.answerCbQuery()
            await withSubDialog(ctx, 'rubrics')
            ctx.ua.pv({dp: `/customize/rubrics/`, dt: `Подобрать под интересы > Рубрики`})

        })
        .action(actionName('priorities'), async ctx => {
            await ctx.answerCbQuery()
            await withSubDialog(ctx, 'priorities')
            ctx.ua.pv({dp: `/customize/priorities/`, dt: `Подобрать под интересы > Приоритеты`})

        })
        .action(actionName('time'), async ctx => {
            await ctx.answerCbQuery()
            await withSubDialog(ctx, 'time')
            ctx.ua.pv({dp: `/customize/time/`, dt: `Подобрать под интересы > Время`})
        })
        .action(actionName('show_personalized_events'), async ctx => {
            prepareSessionStateIfNeeded(ctx)

            if (isThisMessageMatchesWithActiveFilter(ctx)) {

                // await invalidateSliderAndCounters(ctx)

                if (await countFoundEvents(ctx) > 0) {
                    await updateDialog(ctx, 'results')
                    await ctx.answerCbQuery()
                } else {
                    await ctx.answerCbQuery(i18Msg(ctx, 'cb_no_events_found'))
                }
            } else {
                ctx.logger.debug(`isThisMessageMatchesWithActiveFilter = false`)

                await ctx.answerCbQuery()
                await restoreOldCustomize(ctx)
            }
        })
        .action(actionName('card_back'), async ctx => {
            prepareSessionStateIfNeeded(ctx)
            await ctx.answerCbQuery()
            await restoreOldCustomize(ctx)
        })
        .action(actionName('reset_filter'), async ctx => {
            prepareSessionStateIfNeeded(ctx)
            await ctx.answerCbQuery('Фильтр сброшен')
            if (isAnyFilterSelected(ctx)) {
                resetFilter(ctx)
                await invalidateSliderAndCounters(ctx)
                await updateDialog(ctx, 'root')
            }
        })
        .action(actionName('back_to_filters'), async ctx => {
            prepareSessionStateIfNeeded(ctx)
            await ctx.answerCbQuery()
            if (isThisMessageMatchesWithActiveFilter(ctx)) {
                await updateDialog(ctx, 'root')
            } else {
                await restoreOldCustomize(ctx)
            }
        })
}

export const customizeScene: SceneRegister = {
    scene,
    postStageActionsFn
}