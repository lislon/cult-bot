import { BaseScene, Extra, Markup, Telegraf } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { i18nSceneHelper, i18SharedBtn, sleep } from '../../util/scene-helper'
import { SceneRegister } from '../../middleware-utils'
import { botConfig } from '../../util/bot-config'
import { db } from '../../database/db'
import { backToMainButtonTitle, replyDecoyNoButtons, SessionEnforcer } from '../shared/shared-logic'
import { menuMiddleware } from './survey'
import * as tt from 'telegraf/typings/telegram-types'
import { countInteractions } from '../../lib/middleware/analytics-middleware'
import { formatUserName } from '../../util/misc-utils'

const scene = new BaseScene<ContextMessageUpdate>('feedback_scene')
const {actionName, i18nModuleBtnName, scanKeys, i18Btn, i18Msg, backButton} = i18nSceneHelper(scene)

function postStageActionsFn(bot: Telegraf<ContextMessageUpdate>) {
    // bot
    // .hears(i18nModuleBtnName('go_back_to_customize'), async (ctx: ContextMessageUpdate) => {
    //     await goBackToCustomize(ctx)
    // })
    // ;

}

async function sendFeedbackIfListening(ctx: ContextMessageUpdate) {
    if (ctx.session.feedbackScene.isListening !== undefined) {
        await sendFeedbackToOurGroup(ctx)
    } else {
        await ctx.replyWithHTML(
            i18Msg(ctx, 'please_click_write_first', {button: i18Btn(ctx, 'survey.q_landing.send_letter')}),
            inlineBackButtonExtra(ctx, 'feedback_main')
        )
    }
}

async function saveSurveyToDb(ctx: ContextMessageUpdate) {
    ctx.ua.pv({dp: `/feedback/take_survey/done`, dt: `Обратная связь > Завершил опрос`})
    prepareSessionStateIfNeeded(ctx)
    ctx.session.feedbackScene.surveyDone = true
    await db.repoFeedback.saveQuiz({
        what_is_important: ctx.session.feedbackScene.whatImportant.map((r: string) => r.replace(/^opt_/, '')),
        why_not_like: ctx.session.feedbackScene.whyDontLike.map((r: string) => r.replace(/^opt_/, '')),
        isFound: ctx.session.feedbackScene.isFound,
        userId: ctx.session.user.id
    })
}

async function showMainMenu(ctx: ContextMessageUpdate) {
    prepareSessionStateIfNeeded(ctx)

    await replyDecoyNoButtons(ctx, i18Msg(ctx, 'welcome'))
    await menuMiddleware.replyToContext(ctx)
    ctx.ua.pv({dp: `/feedback/`, dt: `Обратная связь`})
}

scene
    .enter(async (ctx: ContextMessageUpdate) => {
        await showMainMenu(ctx)

        ctx.session.feedbackScene.messagesSent = 0
        ctx.session.feedbackScene.surveyDone = false
        ctx.session.feedbackScene.isFound = undefined


    })
    .leave((ctx: ContextMessageUpdate) => {
        ctx.session.feedbackScene = undefined
    })
    .action(actionName('back_to_feedback_main'), async ctx => {
        await ctx.answerCbQuery()
        await showMainMenu(ctx)
    })
    .action('/found/', async (ctx, next) => {
        ctx.ua.pv({dp: `/feedback/take_survey`, dt: `Обратная связь > Опрос`})
        await next()
    })
    .action('/found/not_found/',  async (ctx, next) => {
        ctx.ua.pv({dp: `/feedback/take_survey/not_found`, dt: `Обратная связь > Опрос > Не нашел событий`})
        prepareSessionStateIfNeeded(ctx)
        ctx.session.feedbackScene.isFound = false
        await next()
    })
    .action('/found/your_events/', async (ctx, next) => {
        ctx.ua.pv({dp: `/feedback/take_survey/your_events`, dt: `Обратная связь > Опрос > Нашел события`})
        prepareSessionStateIfNeeded(ctx)
        ctx.session.feedbackScene.isFound = true
        await next()
    })
    .action(/\/found\/not_found\/not_likeT:opt_(?!everything_bad)/, async (ctx: ContextMessageUpdate, next: () => Promise<void>) => {
        prepareSessionStateIfNeeded(ctx)
        ctx.session.feedbackScene.whyDontLike = ctx.session.feedbackScene.whyDontLike.filter(s => s !== 'opt_everything_bad')
        await next()
    })
    .action(/\/found\/not_found\/not_likeT:opt_(everything_bad)/, async (ctx: ContextMessageUpdate, next: () => Promise<void>) => {
        prepareSessionStateIfNeeded(ctx)
        ctx.session.feedbackScene.whyDontLike = []
        await next()
    })
    .action('/found/your_events/end_nice', async (ctx: ContextMessageUpdate, next: () => Promise<void>) => {
        prepareSessionStateIfNeeded(ctx)
        if (ctx.session.feedbackScene.whatImportant.length > 0) {
            await saveSurveyToDb(ctx)
            await sendSurveyToOurGroup(ctx, 'like')
        }
        await next()
    })
    .action('/found/not_found/end_sorry', async (ctx: ContextMessageUpdate, next: () => Promise<void>) => {
        prepareSessionStateIfNeeded(ctx)
        if (ctx.session.feedbackScene.whyDontLike.length > 0) {
            await saveSurveyToDb(ctx)
            await sendSurveyToOurGroup(ctx, 'dislike')
        }
        await next()
    })
    .use(menuMiddleware)
    .hears(backToMainButtonTitle(), async (ctx: ContextMessageUpdate) => {
        if (ctx.session.feedbackScene.isListening !== undefined) {
            ctx.session.feedbackScene.isListening = undefined
            await showMainMenu(ctx)
        } else {
            await ctx.scene.enter('main_scene')
        }
    })
    .hears(/^[^/].*$/, async (ctx: ContextMessageUpdate) => {
        await sendFeedbackIfListening(ctx)
    })
    .on(['voice', 'sticker', 'document', 'photo', 'animation'], async (ctx: ContextMessageUpdate) => {
        await sendFeedbackIfListening(ctx)
    })

function userSelected(ctx: ContextMessageUpdate, selected: string[], question: 'q_why_not_like' | 'q_what_is_important') {
    const selections = selected
        .map(s => ' - ' + i18Btn(ctx, `survey.${question}.${s}`))
        .join('\n')
    return {selections}
}

async function sendSurveyToOurGroup(ctx: ContextMessageUpdate, result: IsListening) {
    if (botConfig.SUPPORT_FEEDBACK_CHAT_ID !== undefined) {
        let template
        if (result === 'like') {
            template = i18Msg(ctx, 'admin_survey_template_like', {
                ...getBasicTemplateForAdminMessage(ctx),
                ...userSelected(ctx, ctx.session.feedbackScene.whatImportant, 'q_what_is_important')
            })
        } else {
            template = i18Msg(ctx, 'admin_survey_template_dislike', {
                ...getBasicTemplateForAdminMessage(ctx),
                ...userSelected(ctx, ctx.session.feedbackScene.whyDontLike, 'q_why_not_like')
            })
        }
        await ctx.telegram.sendMessage(botConfig.SUPPORT_FEEDBACK_CHAT_ID, template, {
            parse_mode: 'HTML',
            disable_web_page_preview: true
        })
    }
}

function getBasicTemplateForAdminMessage(ctx: ContextMessageUpdate) {
    return {
        userId: ctx.session.user.id,
        user: formatUserName(ctx),
        text: ctx.message?.text,
        clickCount: countInteractions(ctx),
        uaUuid: ctx.session.user.uaUuid
    }
}


function inlineBackButtonExtra(ctx: ContextMessageUpdate, where: 'feedback_main' = undefined) {
    if (where === 'feedback_main') {
        return Extra.HTML().markup(Markup.inlineKeyboard([[Markup.callbackButton(i18SharedBtn('back'), actionName('back_to_feedback_main'))]]))
    } else {
        return Extra.HTML().markup(Markup.inlineKeyboard([[backButton(ctx)]]))
    }
}

async function sendFeedbackToOurGroup(ctx: ContextMessageUpdate) {
    if (botConfig.SUPPORT_FEEDBACK_CHAT_ID !== undefined) {
        const tplData = getBasicTemplateForAdminMessage(ctx)

        let adminMessage: tt.Message
        if (ctx.message.text !== undefined) {
            let template
            if (ctx.session.feedbackScene.isListening === 'text') {
                template = i18Msg(ctx, 'admin_feedback_template_text', tplData)
            } else if (ctx.session.feedbackScene.isListening === 'like') {
                template = i18Msg(ctx, 'admin_feedback_template_like', {
                    ...tplData,
                    ...userSelected(ctx, ctx.session.feedbackScene.whatImportant, 'q_what_is_important')
                })
            } else if (ctx.session.feedbackScene.isListening === 'dislike') {
                template = i18Msg(ctx, 'admin_feedback_template_dislike', {
                    ...tplData,
                    ...userSelected(ctx, ctx.session.feedbackScene.whyDontLike, 'q_why_not_like')
                })
            }
            adminMessage = await ctx.telegram.sendMessage(botConfig.SUPPORT_FEEDBACK_CHAT_ID, template, Extra.HTML().markup(undefined))
        } else {
            const template = i18Msg(ctx, 'admin_feedback_template_other', tplData)
            await ctx.telegram.sendMessage(botConfig.SUPPORT_FEEDBACK_CHAT_ID, template, Extra.HTML().markup(undefined))
            adminMessage = await ctx.telegram.forwardMessage(botConfig.SUPPORT_FEEDBACK_CHAT_ID, ctx.chat.id, ctx.message.message_id)
        }

        await db.repoFeedback.saveFeedback({
            userId: ctx.session.user.id,
            messageId: ctx.message.message_id,
            feedbackText: ctx.message.text || 'other media: ' + JSON.stringify(ctx.message),
            adminChatId: botConfig.SUPPORT_FEEDBACK_CHAT_ID,
            adminMessageId: adminMessage.message_id
        })

        if (ctx.session.feedbackScene.messagesSent === 0) {
            if (ctx.session.feedbackScene.isListening === 'text') {
                await ctx.replyWithHTML(i18Msg(ctx, 'thank_you_message'), inlineBackButtonExtra(ctx))
            } else {
                await ctx.replyWithHTML(i18Msg(ctx, 'thank_you_for_custom_feedback'), inlineBackButtonExtra(ctx))
            }
        } else {
            if (ctx.session.feedbackScene.messagesSent === 5) {
                const messageSticker = await ctx.replyWithSticker(i18Msg(ctx, 'sticker_stop_it'))
                await sleep(1000)
                await ctx.deleteMessage(messageSticker.message_id)
            }
            await ctx.replyWithHTML(i18Msg(ctx, 'your_feedback_was_amended'), inlineBackButtonExtra(ctx))
        }
        ctx.session.feedbackScene.messagesSent++

    } else {
        console.log(`ERROR: SUPPORT_FEEDBACK_CHAT_ID IS NULL, But we have message: '${ctx.message.text}'`)
    }
}


function prepareSessionStateIfNeeded(ctx: ContextMessageUpdate) {
    const {
        messagesSent,
        isListening,
        whatImportant,
        whyDontLike,
        surveyDone,
        isFound
    } = ctx.session.feedbackScene || {}

    ctx.session.feedbackScene = {
        messagesSent: SessionEnforcer.number(messagesSent, 0),
        isListening: ['like', 'dislike', 'text'].includes(isListening) ? isListening : undefined,
        surveyDone: surveyDone || false,
        whatImportant: SessionEnforcer.array(whatImportant),
        whyDontLike: SessionEnforcer.array(whyDontLike),
        isFound: isFound
    }
}

export const feedbackScene = {
    scene,
    postStageActionsFn
} as SceneRegister

export type IsListening = 'like' | 'dislike' | 'text'

export interface FeedbackSceneState {
    isListening?: IsListening
    messagesSent: number
    whatImportant: string[]
    whyDontLike: string[]
    isFound?: boolean
    surveyDone: boolean
}
