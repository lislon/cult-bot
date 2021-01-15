import { BaseScene, Composer, Markup } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { i18nSceneHelper } from '../../util/scene-helper'
import { CallbackButton, InlineKeyboardButton } from 'telegraf/typings/markup'
import {
    editMessageAndButtons,
    EditMessageAndButtonsOptions,
    generatePlural,
    getMsgId,
    replyDecoyNoButtons
} from '../shared/shared-logic'
import { formatExplainCennosti, formatExplainFormat, formatExplainOblasti, formatExplainTime } from './format-explain'
import { resetSessionIfProblem } from './customize-utils'
import { SceneRegister } from '../../middleware-utils'
import { isEmpty } from 'lodash'
import { prepareRepositoryQuery, prepareSessionStateIfNeeded, StageType } from './customize-common'
import { cennostiOptionLogic, customizeCennosti } from './filters/customize-cennosti'
import { customizeOblasti, oblastiOptionLogic } from './filters/customize-oblasti'
import { getKeyboardTime, timeOptionLogic } from './filters/customize-time'
import { formatOptionLogic, getKeyboardFormat } from './filters/customize-format'
import { SliderPager } from '../shared/slider-pager'
import { CustomizePagerConfig } from './customize-pager-config'
import { db } from '../../database/db'
import { logger } from '../../util/logger'

const scene = new BaseScene<ContextMessageUpdate>('customize_scene')

const {backButton, actionName, i18nModuleBtnName, revertActionName, scanKeys, i18nSharedBtnName, i18Btn, i18Msg, i18SharedBtn} = i18nSceneHelper(scene)

const eventSlider = new SliderPager(new CustomizePagerConfig())

async function showFilteredEventsButton(ctx: ContextMessageUpdate) {

    return Markup.callbackButton(i18Btn(ctx,
        await countFoundEvents(ctx) > 0 ? 'show_personalized_events' : 'show_personalized_events_zero', {
            count: await countFoundEvents(ctx)
        }), actionName('show_personalized_events'))
}

function isAnyFilterSelected(ctx: ContextMessageUpdate): boolean {
    const state = ctx.session.customize
    return (state.format.length + state.oblasti.length + state.cennosti.length + state.time.length) > 0
}

function resetButton(ctx: ContextMessageUpdate) {
    return Markup.callbackButton(i18Btn(ctx, 'reset_filter'), actionName('reset_filter'))
}

const getRootKeyboard = async (ctx: ContextMessageUpdate): Promise<CallbackButton[][]> => {
    const selected = i18Btn(ctx, 'selected_filter_postfix')

    function btn(name: string, state: string[]): CallbackButton {
        return Markup.callbackButton(i18Btn(ctx, name) + (isEmpty(state) ? '' : ' ' + selected), actionName(name))
    }

    const showEventsBtn = await showFilteredEventsButton(ctx)
    return [
        [btn('format', ctx.session.customize.format), btn('oblasti', ctx.session.customize.oblasti)],
        [btn('priorities', ctx.session.customize.cennosti), btn('time', ctx.session.customize.time)],
        [resetButton(ctx)],
        [backButton(ctx), showEventsBtn],
    ]
}

function resetOpenMenus(ctx: ContextMessageUpdate) {
    prepareSessionStateIfNeeded(ctx)
    ctx.session.customize.openedMenus = []
}

function resetFilter(ctx: ContextMessageUpdate) {
    prepareSessionStateIfNeeded(ctx)
    const state = ctx.session.customize
    state.oblasti = []
    state.cennosti = []
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
        prepareLine(formatExplainOblasti(ctx, i18Msg)),
        prepareLine(formatExplainCennosti(ctx, i18Msg)),
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
            Markup.callbackButton(i18Btn(ctx, 'back_to_filters'), actionName('back_to_filters')),
            Markup.callbackButton(await showGoToResultsButton(ctx), actionName('show_personalized_events'))
        ]
    }

    if (subStage === 'results') {
        return await eventSlider.showOrUpdateSlider(ctx)
    }

    const kbs: Record<StageType, () => Promise<InlineKeyboardButton[][]>> = {
        results: undefined,
        root: async () => await getRootKeyboard(ctx),
        format: async () => [...await getKeyboardFormat(ctx), await btnRow()],
        oblasti: async () => [...await customizeOblasti(ctx), await btnRow()],
        priorities: async () => [...await customizeCennosti(ctx), await btnRow()],
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
    logger.info('msgId: ' + msgId)
    return msgId
}

// async function goBackToCustomize(ctx: ContextMessageUpdate) {
//     prepareSessionStateIfNeeded(ctx)
//     await updateDialog(ctx, 'root')
// }

async function checkOrUncheckMenuState(ctx: ContextMessageUpdate) {
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
    const {format, oblasti, cennosti, time} = ctx.session.customize
    const state = {format, oblasti, cennosti, time}
    await eventSlider.updateState(ctx, state, await countFoundEvents(ctx), msgId ?? getMsgId(ctx))
}

async function countFoundEvents(ctx: ContextMessageUpdate) {
    if (ctx.session.customize.resultsFound === undefined) {
        return await db.repoCustomEvents.countEventsCustomFilter({
            ...prepareRepositoryQuery(ctx, ctx.session.customize),
        })
    }
    return ctx.session.customize.resultsFound
}

async function answerCbEventsSelected(ctx: ContextMessageUpdate) {
    const count = await countFoundEvents(ctx)
    await ctx.answerCbQuery(i18Msg(ctx, count > 0 ? 'popup_selected' : 'popup_zero_selected',
        {eventPlural: generatePlural(ctx, 'event', count)}))
}


function isThisMessageMatchesWithActiveFilter(ctx: ContextMessageUpdate) {
    return ctx.session.customize.msgId === undefined || ctx.session.customize.msgId === getMsgId(ctx)
}

scene
    .enter(async (ctx: ContextMessageUpdate) => {
        prepareSessionStateIfNeeded(ctx)
        await replyDecoyNoButtons(ctx)
        ctx.session.customize.resultsFound = undefined
        ctx.session.customize.msgId = await updateDialog(ctx, 'root', {forceNewMsg: true, restoreMessage: true})
        await invalidateSliderAndCounters(ctx, ctx.session.customize.msgId)
    })
    .leave((ctx: ContextMessageUpdate) => {
        ctx.session.customize = undefined
        // resetFilter(ctx)
        // ctx.session.customize.currentStage = 'root'
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
        await invalidateSliderAndCounters(ctx)
        await answerCbEventsSelected(ctx)
        await updateDialog(ctx, 'priorities')
    })
    .action(/customize_scene[.]o_(.+)/, async (ctx: ContextMessageUpdate) => {
        oblastiOptionLogic(ctx, ctx.match[1])
        await invalidateSliderAndCounters(ctx)
        await answerCbEventsSelected(ctx)
        await updateDialog(ctx, 'oblasti')
    })
    .action(/customize_scene[.]t_(.+)/, async (ctx: ContextMessageUpdate) => {
        timeOptionLogic(ctx, ctx.match[1])
        await invalidateSliderAndCounters(ctx)

        await answerCbEventsSelected(ctx)
        await updateDialog(ctx, 'time')
    })
    .action(/customize_scene[.]f_(.+)/, async (ctx: ContextMessageUpdate) => {
        formatOptionLogic(ctx, ctx.match[1])
        await invalidateSliderAndCounters(ctx)

        await answerCbEventsSelected(ctx)
        await updateDialog(ctx, 'format')
    })
    .action(actionName('last_card_back'), async (ctx: ContextMessageUpdate) => {
        await ctx.answerCbQuery()
        await resetSessionIfProblem(ctx, async () => {
            prepareSessionStateIfNeeded(ctx)
            await updateDialog(ctx, 'root')
        })
    })
    .action(actionName('card_back'), async (ctx: ContextMessageUpdate) => {
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
    .hears(i18nModuleBtnName('back'), async (ctx: ContextMessageUpdate) => {
        await resetSessionIfProblem(ctx, async () => {
            prepareSessionStateIfNeeded(ctx)
            if (ctx.session.customize.currentStage === 'root') {
                await ctx.scene.enter('main_scene')
            } else {
                await updateDialog(ctx, 'root')
            }
        })
    })

async function editMessageNotifyUserItsOld(ctx: ContextMessageUpdate) {
    await editMessageAndButtons(ctx, [], 'Это сообщение уже старое. Сорян')
}

async function editMessageNotifyUserViewBelow(ctx: ContextMessageUpdate) {
    await editMessageAndButtons(ctx, [], '👇 Этот фильтр уже устарел. Отмотайте, пожалуйста чат вниз, чтобы восстановить его')
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
        await eventSlider.updateState(ctx, restoreState, await countFoundEvents(ctx), msgId)
    }
}

function postStageActionsFn(bot: Composer<ContextMessageUpdate>) {
    bot
        .use(eventSlider.middleware())
        .action(actionName('format'), async (ctx: ContextMessageUpdate) => {
            await ctx.answerCbQuery()
            await withSubDialog(ctx, 'format')
            ctx.ua.pv({dp: `/customize/format/`, dt: `Подобрать под мои интересы > Формат`})
        })
        .action(actionName('oblasti'), async (ctx: ContextMessageUpdate) => {
            await ctx.answerCbQuery()
            await withSubDialog(ctx, 'oblasti')
            ctx.ua.pv({dp: `/customize/rubrics/`, dt: `Подобрать под мои интересы > Рубрики`})

        })
        .action(actionName('priorities'), async (ctx: ContextMessageUpdate) => {
            await ctx.answerCbQuery()
            await withSubDialog(ctx, 'priorities')
            ctx.ua.pv({dp: `/customize/priorities/`, dt: `Подобрать под мои интересы > Приоритеты`})

        })
        .action(actionName('time'), async (ctx: ContextMessageUpdate) => {
            await ctx.answerCbQuery()
            await withSubDialog(ctx, 'time')
            ctx.ua.pv({dp: `/customize/time/`, dt: `Подобрать под мои интересы > Время`})
        })
        .action(actionName('show_personalized_events'), async (ctx: ContextMessageUpdate) => {
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
                await ctx.answerCbQuery()
                await restoreOldCustomize(ctx)
            }
        })
        .action(actionName('card_back'), async (ctx: ContextMessageUpdate) => {
            prepareSessionStateIfNeeded(ctx)
            await ctx.answerCbQuery()
            await restoreOldCustomize(ctx)
        })
        .action(actionName('reset_filter'), async (ctx: ContextMessageUpdate) => {
            prepareSessionStateIfNeeded(ctx)
            await ctx.answerCbQuery('Фильтр сброшен')
            if (isAnyFilterSelected(ctx)) {
                resetFilter(ctx)
                await invalidateSliderAndCounters(ctx)
                await updateDialog(ctx, 'root')
            }
        })
        .action(actionName('back_to_filters'), async (ctx: ContextMessageUpdate) => {
            prepareSessionStateIfNeeded(ctx)
            await ctx.answerCbQuery()
            if (isThisMessageMatchesWithActiveFilter(ctx)) {
                await updateDialog(ctx, 'root')
            } else {
                await restoreOldCustomize(ctx)
            }
        })
}

export const customizeScene = {
    scene,
    postStageActionsFn
} as SceneRegister