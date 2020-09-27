import { BaseScene, Markup } from 'telegraf'
import { ContextMessageUpdate } from '../interfaces/app-interfaces'
import { i18n } from '../middleware-utils'
import { StupidTranslit } from '../lib/translit/stupid-translit'

export function i18nSceneHelper(scene: BaseScene<ContextMessageUpdate>) {
    const backAction = scene.id + 'button.back'

    const pushEnterScene = async (ctx: ContextMessageUpdate, nextSceneId: string) => {
            if (ctx.session.sceneStack === undefined) {
            ctx.session.sceneStack = []
        }
        ctx.session.sceneStack.push(scene.id)
        await ctx.scene.enter(nextSceneId)
    }

    return {
        backButton: (ctx: ContextMessageUpdate) => Markup.callbackButton(ctx.i18n.t('shared.keyboard.back'), backAction),
        actionName: (id: string) => `${scene.id}.${StupidTranslit.translit(id)}`,
        revertActionName: (id: string) => `${StupidTranslit.reverse(id)}`,
        pushEnterScene,
        sceneHelper: (ctx: ContextMessageUpdate) => {
            return {
                // scenes.<scene id>.keyboard.<id>
                i18Btn: (id: string, tplData: object = undefined) =>
                    ctx.i18n.t(`scenes.${scene.id}.keyboard.${id}`, tplData),
                i18SharedBtn: (id: string, tplData: object = undefined) =>
                    ctx.i18n.t(`shared.keyboard.${id}`, tplData),
                // scenes.<scene id>.<id>
                i18Msg: (id: string, tplData: object = undefined) =>
                    ctx.i18n.t(`scenes.${scene.id}.${id}`, tplData)
            }
        },
        i18nModuleBtnName: (id: string) => {
            return i18n.t(`ru`, `scenes.${scene.id}.keyboard.${id}`)
        },
    }
}

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}