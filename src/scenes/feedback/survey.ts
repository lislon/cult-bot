import { deleteMenuFromContext, MenuMiddleware, MenuTemplate } from 'telegraf-inline-menu'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { i18nSceneHelper } from '../../util/scene-helper'
import { i18nButtonText, keyAnswers, optionSet } from './survey-utils'

const {actionName, i18nModuleBtnName, i18nModuleMsg, scanKeys, i18nSharedBtnName} = i18nSceneHelper({id: 'feedback_scene'})

const landingMenu = new MenuTemplate<ContextMessageUpdate>(i18nModuleMsg('survey.q_landing'))
const menuIsFoundEvent = new MenuTemplate<ContextMessageUpdate>(i18nModuleMsg('survey.q_found_events'))
const menuPositive = new MenuTemplate<ContextMessageUpdate>(i18nModuleMsg('survey.q_what_is_important'))
const menuNegative = new MenuTemplate<ContextMessageUpdate>(i18nModuleMsg('survey.q_why_not_like'))
const menuEndNice = new MenuTemplate<ContextMessageUpdate>(i18nModuleMsg('survey.end_nice'))
const menuEndSorry = new MenuTemplate<ContextMessageUpdate>(i18nModuleMsg('survey.end_sorry'))


function doInviteToEnterText(msgId: string) {
    return async (ctx: ContextMessageUpdate) => {
        await ctx.answerCbQuery()
        await deleteMenuFromContext(ctx)
        await ctx.replyWithHTML(ctx.i18Msg(msgId))
        ctx.session.feedbackScene.isListening = true
        return false
    }
}

landingMenu.interact(i18nModuleBtnName('survey.q_landing.send_letter'), 'act', {
    do: doInviteToEnterText('survey.write_now'),
    joinLastRow: true
})

landingMenu.submenu(i18nModuleBtnName('survey.q_landing.take_survey'), 'found', menuIsFoundEvent, {
    joinLastRow: true,
})

landingMenu.submenu('1', 'end_sorry', menuEndSorry, {
    hide: (ctx) => !ctx.session.feedbackScene.surveyDone
})


const OPT_SAME_ROW = { joinLastRow: true }
menuIsFoundEvent.submenu(i18nModuleBtnName('survey.q_found_events.no'), 'not_found', menuNegative, OPT_SAME_ROW)
menuIsFoundEvent.submenu(i18nModuleBtnName('survey.q_found_events.yes'), 'your_events', menuPositive, OPT_SAME_ROW)
menuIsFoundEvent.navigate(i18nSharedBtnName('back'), '..')



menuNegative.select('not_like', keyAnswers(`q_why_not_like`), {
    ...optionSet('whyDontLike'),
    buttonText: i18nButtonText('q_why_not_like')
})
menuNegative.interact(i18nModuleBtnName('survey.q_why_not_like.comment'),
    'write_not_like', {
    do: doInviteToEnterText('survey.write_now_important'),
})

menuNegative.navigate(i18nSharedBtnName('back'), '..')
menuNegative.submenu(i18nModuleBtnName('finish_survey'), 'end_sorry', menuEndNice, OPT_SAME_ROW)



menuPositive.select('important', keyAnswers(`q_what_is_important`), {
    ...optionSet('whatImportant'),
    buttonText: i18nButtonText('q_what_is_important'),
})
menuPositive.interact(i18nModuleBtnName('survey.q_what_is_important.comment'), 'write_important', {
    do: doInviteToEnterText('survey.write_now_important'),
})
menuPositive.navigate(i18nSharedBtnName('back'), '..')
menuPositive.submenu(i18nModuleBtnName('finish_survey'), 'end_nice', menuEndNice, OPT_SAME_ROW)

const menuMiddleware = new MenuMiddleware('/', landingMenu)
// console.log(menuMiddleware.tree())

export { menuMiddleware }