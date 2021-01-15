import { deleteMenuFromContext, MenuMiddleware, MenuTemplate } from 'telegraf-inline-menu'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { i18nSceneHelper } from '../../util/scene-helper'
import { i18nButtonText, keyAnswers, optionSet } from './survey-utils'
import { IsListening } from './feedback-scene'
import { ExtraReplyMessage } from 'telegraf/typings/telegram-types'
import { Extra, Markup } from 'telegraf'
import { backToMainButtonTitle } from '../shared/shared-logic'

const {actionName, i18nModuleBtnName, i18nModuleMsg, scanKeys, i18nSharedBtnName, i18Msg} = i18nSceneHelper({id: 'feedback_scene'})

const landingMenu = new MenuTemplate<ContextMessageUpdate>(i18nModuleMsg('survey.q_landing'))
const menuIsFoundEvent = new MenuTemplate<ContextMessageUpdate>(i18nModuleMsg('survey.q_found_events'))
const menuPositive = new MenuTemplate<ContextMessageUpdate>(i18nModuleMsg('survey.q_what_is_important'))
const menuNegative = new MenuTemplate<ContextMessageUpdate>(i18nModuleMsg('survey.q_why_not_like'))


function doInviteToEnterText(msgId: string, isListening: IsListening, extra?: ExtraReplyMessage) {
    return async (ctx: ContextMessageUpdate) => {
        if (isListening === 'text') {
            ctx.ua.pv({dp: `/feedback/send_letter`, dt: `Обратная связь > Написать авторам`})
        } else if (isListening === 'like') {
            ctx.ua.pv({dp: `/feedback/take_survey/like`, dt: `Обратная связь > Нашел события > Свой вариант`})
        } else if (isListening === 'dislike') {
            ctx.ua.pv({dp: `/feedback/take_survey/dislike`, dt: `Обратная связь > Не понравилось > Свой вариант`})
        }
        await ctx.answerCbQuery()
        await deleteMenuFromContext(ctx)
        await ctx.replyWithHTML(i18Msg(ctx, msgId), extra)
        ctx.session.feedbackScene.isListening = isListening
        return false
    }
}

function getBackButton() {
    return Extra.markup(Markup.keyboard([[Markup.button(backToMainButtonTitle())]]).resize())
}

landingMenu.interact(i18nModuleBtnName('survey.q_landing.send_letter'), 'act', {
    do: doInviteToEnterText('survey.write_now', 'text', getBackButton()),
    joinLastRow: true
})

landingMenu.submenu(i18nModuleBtnName('survey.q_landing.take_survey'), 'found', menuIsFoundEvent, {
    joinLastRow: false,
})

landingMenu.interact(i18nSharedBtnName('back'), 'back', {
    do: async (ctx: ContextMessageUpdate) => {
        await ctx.scene.enter('main_scene')
        return false
    },
    joinLastRow: false
})


const OPT_SAME_ROW = {joinLastRow: true}
menuIsFoundEvent.submenu(i18nModuleBtnName('survey.q_found_events.no'), 'not_found', menuNegative, OPT_SAME_ROW)
menuIsFoundEvent.submenu(i18nModuleBtnName('survey.q_found_events.yes'), 'your_events', menuPositive, OPT_SAME_ROW)
menuIsFoundEvent.navigate(i18nSharedBtnName('back'), '..')


menuNegative.select('not_like', keyAnswers(`q_why_not_like`), {
    ...optionSet('whyDontLike'),
    buttonText: i18nButtonText('q_why_not_like')
})
menuNegative.interact(i18nModuleBtnName('survey.q_why_not_like.comment'),
    'write_not_like', {
        do: doInviteToEnterText('survey.write_now_not_like', 'dislike', getBackButton()),
    })

menuNegative.navigate(i18nSharedBtnName('back'), '..')

function selectAtLeastOne(predicate: (ctx: ContextMessageUpdate) => boolean, responseId: 'end_sorry' | 'end_nice') {
    return async (ctx: ContextMessageUpdate) => {
        if (predicate(ctx)) {
            await ctx.answerCbQuery()
            await deleteMenuFromContext(ctx)
            await ctx.replyWithHTML(i18nModuleMsg(`survey.${responseId}`))
        } else {
            await ctx.answerCbQuery(i18Msg(ctx, 'select_at_least_one'), true)
        }
        return false
    }
}

menuNegative.interact(i18nModuleBtnName('finish_survey'), 'end_sorry',
    {
        ...OPT_SAME_ROW,
        do: selectAtLeastOne(ctx => ctx.session.feedbackScene.whyDontLike.length > 0, 'end_sorry'),
    })


menuPositive.select('important', keyAnswers(`q_what_is_important`), {
    ...optionSet('whatImportant'),
    buttonText: i18nButtonText('q_what_is_important'),
})
menuPositive.interact(i18nModuleBtnName('survey.q_what_is_important.comment'), 'write_important', {
    do: doInviteToEnterText('survey.write_now_important', 'like', getBackButton()),
})
menuPositive.navigate(i18nSharedBtnName('back'), '..')
menuPositive.interact(i18nModuleBtnName('finish_survey'), 'end_nice',
    {
        ...OPT_SAME_ROW,
        do: selectAtLeastOne(ctx => ctx.session.feedbackScene.whatImportant.length > 0, 'end_nice'),
    })

export const menuMiddleware = new MenuMiddleware('/', landingMenu)
// console.log(menuMiddleware.tree())
