import { BaseScene, Markup } from 'telegraf'
import { ContextMessageUpdate } from '../interfaces/app-interfaces'
import { ReversableTranslit } from '../lib/translit/reversable-translit'
import { i18n } from './i18n'
import { adminIds, adminUsernames, devUsernames } from './admins-list'
import { CallbackButton } from 'telegraf/typings/markup'

export function i18SharedBtn(id: string, tplData: object = undefined) {
    return i18n.t(`ru`, `shared.keyboard.${id}`, tplData)
}

export function i18SharedMsg(id: string, tplData: object = undefined) {
    return i18n.t(`ru`, `shared.${id}`, tplData)
}

export function i18nSceneHelper(scene: Pick<BaseScene<ContextMessageUpdate>, 'id'>) {
    const backAction = scene.id + '.button.back'

    const pushEnterScene = async (ctx: ContextMessageUpdate, nextSceneId: string) => {
        await ctx.scene.enter(nextSceneId)
    }

    return {
        backButton: (): CallbackButton => Markup.callbackButton(i18n.t('ru', 'shared.keyboard.back'), backAction),
        actionName: (id: string) => `${scene.id}.${ReversableTranslit.translit(id)}`,
        actionNameRegex: (id: RegExp) => new RegExp(`^${scene.id}[.]${id.source}`),
        revertActionName: (id: string) => {
            if (id.startsWith('#_')) {
                // this is needed to handle menu buttons with #_tags like this
                // otherwise it converted to '# tag' with space!
                return `#_${ReversableTranslit.reverse(id.substring(2))}`
            }
            return ReversableTranslit.reverse(id)
        },
        pushEnterScene,

        i18Btn: (ctx: ContextMessageUpdate, id: string, tplData: object = undefined) =>
            ctx.i18n.t(`scenes.${scene.id}.keyboard.${id}`, tplData),
        i18SharedBtn: (ctx: ContextMessageUpdate, id: string, tplData: object = undefined) =>
            ctx.i18n.t(`shared.keyboard.${id}`, tplData),
        // scenes.<scene id>.<id>
        i18Msg: (ctx: ContextMessageUpdate, id: string, tplData: object = undefined, byDefault: string | null = undefined) => {
            const resourceKey = `scenes.${scene.id}.${id}`
            if (byDefault === undefined || i18n.resourceKeys('ru').includes(resourceKey)) {
                try {
                    return ctx.i18n.t(resourceKey, tplData)
                } catch (e) {
                    throw Error(`Compile error for template '${resourceKey}': ${e}`)
                }
            } else {
                return byDefault
            }
        },
        i18SharedMsg: (ctx: ContextMessageUpdate, id: string, tplData: object = undefined) =>
            ctx.i18n.t(`shared.${id}`, tplData),

        sceneHelper: (ctx: ContextMessageUpdate) => {
            return {
                // scenes.<scene id>.keyboard.<id>
                i18Btn: (id: string, tplData: object = undefined) =>
                    ctx.i18n.t(`scenes.${scene.id}.keyboard.${id}`, tplData),
                i18SharedBtn: (id: string, tplData: object = undefined) =>
                    ctx.i18n.t(`shared.keyboard.${id}`, tplData),
                // scenes.<scene id>.<id>
                i18Msg: (id: string, tplData: object = undefined, byDefault: string | null = undefined) => {
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
        i18nModuleMsg: (id: string) => {
            return i18n.t(`ru`, `scenes.${scene.id}.${id}`)
        },
        i18nSharedBtnName: (id: string, templateData?: any) => {
            return i18n.t(`ru`, `shared.keyboard.${id}`, templateData)
        },
        scanKeys: (prefix: string, mode: 'return_only_postfix' | undefined = undefined): string[] => {
            return i18n.resourceKeys(`ru`)
                .filter(s => s.startsWith(`scenes.${scene.id}.${prefix}`))
                .map(s => mode === 'return_only_postfix' ? s.substring(`scenes.${scene.id}.${prefix}`.length + 1) : s)
        }
    }
}

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

export function isDev(ctx: ContextMessageUpdate) {
    return devUsernames.includes(`@${ctx.from.username}`)
}

export function isAdmin(ctx: ContextMessageUpdate) {
    return adminUsernames.includes(ctx.from.username) || adminIds.includes(ctx.from.id)
}
export async function ifAdmin(ctx: ContextMessageUpdate, callback: () => Promise<any>) {
    if (isAdmin(ctx)) {
        return await callback()
    } else {
        await ctx.replyWithHTML(ctx.i18n.t('shared.no_admin'))
    }
}
