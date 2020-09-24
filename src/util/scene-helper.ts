import { BaseScene, Markup } from 'telegraf'
import { ContextMessageUpdate } from '../interfaces/app-interfaces'
import { i18n } from '../middleware-utils'

export function backButtonRegister(scene: BaseScene<ContextMessageUpdate>) {
    console.log(`backButtonRegister(${scene.id})`)
    const backAction = scene.id + 'button..back'

    // scene.action(backAction, async (ctx: ContextMessageUpdate) => {
    //     console.log('backButtonRegister works!: ' + backAction )
    //     return await ctx.scene.leave()
    // })
    // scene.enter(async (ctx: ContextMessageUpdate, next: any) => {
    //     // await ctx.reply('Enter scene' + ctx.scene.current.id)
    //     console.log('Enter scene' + ctx.scene.current.id)
    //     return next()
    // });
    // scene.leave(async (ctx: ContextMessageUpdate, next: any) => {
    //     // await ctx.reply('Leave scene' + ctx.scene.current.id)
    //     console.log('Leave scene' + ctx.scene.current.id)
    //     return next()
    // });
    // scene.leave(async (ctx: ContextMessageUpdate, next: any) => {
    //     if (ctx.session.sceneStack && ctx.session.sceneStack.length > 0 && ctx.session.sceneStack[ctx.session.sceneStack.length - 1] != ctx.scene.current.id) {
    //         const oldSceneId = ctx.session.sceneStack.pop()
    //         console.log('backButtonRegister, now go to ' + oldSceneId)
    //         return await ctx.scene.enter(oldSceneId, {}, true)
    //     } else {
    //         return next()
    //     }
    // });

    const actionName = (id: String) => `${scene.id}.${id}`
    const pushEnterScene = async (ctx: ContextMessageUpdate, nextSceneId: string) => {
            if (ctx.session.sceneStack === undefined) {
            ctx.session.sceneStack = []
        }
        ctx.session.sceneStack.push(scene.id)
        await ctx.scene.enter(nextSceneId)
    }

    return {
        backButton: (ctx: ContextMessageUpdate) => Markup.callbackButton(ctx.i18n.t('shared.keyboard.back'), backAction),
        actionName,
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