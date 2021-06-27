import { i18nSceneHelper } from '../../util/scene-helper'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { SelectOptions } from 'telegraf-inline-menu/dist/source/buttons/select'
import { checkboxi18nBtnId } from '../shared/shared-logic'

const {actionName, i18nModuleBtnName, i18nModuleMsg, scanKeys, i18nSharedBtnName, i18Btn} = i18nSceneHelper({id: 'feedback_scene'})


export function keyAnswers(questionId: string): () => string[] {
    return () => scanKeys(`keyboard.survey.${questionId}`, 'return_only_postfix')
        .filter(s => s.startsWith('opt_'))
}

export function i18nButtonText(questionId: string) {
    return (context: ContextMessageUpdate, key: string) => i18Btn(context, `survey.${questionId}.${key}`)
}

export function optionSet(field: 'whatImportant' | 'whyDontLike'): SelectOptions<ContextMessageUpdate> {
    return {
        set: (ctx: ContextMessageUpdate, key: string) => {
            if (ctx.session.feedbackScene[field].includes(key)) {
                ctx.session.feedbackScene[field] = ctx.session.feedbackScene[field].filter(k => k !== key)
            } else {
                ctx.session.feedbackScene[field].push(key)
            }
            return true
        },
        isSet: (ctx: ContextMessageUpdate, key: string) => {
            return ctx.session.feedbackScene[field].includes(key)
        },
        columns: 1,
        formatState: ((ctx, textResult, state) => {
            return textResult + checkboxi18nBtnId(ctx, state)
        }),
    }
}