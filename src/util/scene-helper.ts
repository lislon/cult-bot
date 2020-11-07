import { BaseScene, Markup } from 'telegraf'
import { ContextMessageUpdate } from '../interfaces/app-interfaces'
import { StupidTranslit } from '../lib/translit/stupid-translit'
import { i18n } from './i18n'

export function i18nSceneHelper(scene: BaseScene<ContextMessageUpdate>) {
    const backAction = scene.id + 'button.back'

    const pushEnterScene = async (ctx: ContextMessageUpdate, nextSceneId: string) => {
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
                i18Msg: (id: string, tplData: object = undefined, byDefault: string|null = undefined) => {
                    const resourceKey = `scenes.${scene.id}.${id}`
                    if (byDefault === undefined || i18n.resourceKeys('ru').includes(resourceKey)) {
                        return ctx.i18n.t(resourceKey, tplData)
                    } else {
                        return byDefault
                    }
                }
            }
        },
        i18nModuleBtnName: (id: string) => {
            return i18n.t(`ru`, `scenes.${scene.id}.keyboard.${id}`)
        },
        i18nSharedBtnName: (id: string, templateData?: any) => {
            return i18n.t(`ru`, `shared.keyboard.${id}`, templateData)
        },
        scanKeys: (postfix: string): string[] => {
            return i18n.resourceKeys(`ru`)
                .filter(s => s.startsWith(`scenes.${scene.id}.${postfix}`))
        }
    }
}

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function isDev(ctx: ContextMessageUpdate) {
    const devs = [
        '@lislon',
        '@kashmar85',
    ]
    return devs.includes(`@${ctx.from.username}`);
}

export function isAdmin(ctx: ContextMessageUpdate) {
    const admins = [
        '@lislon',
        '@RemboTrembo',
        '@kashmar85',
    ]
    const adminIds = [
        781083907, // Anna
        1344589946 // Elena G
    ]
    return admins.includes(`@${ctx.from.username}`) || adminIds.includes(ctx.from.id);
}
export async function ifAdmin(ctx: ContextMessageUpdate, callback: () => Promise<any>) {
    if (isAdmin(ctx)) {
        return await callback()
    } else {
        await ctx.replyWithHTML(ctx.i18n.t('shared.no_admin'));
    }
}
