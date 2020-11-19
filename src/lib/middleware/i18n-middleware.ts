import { i18n } from '../../util/i18n'
import { Composer } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { MiddlewareFn } from 'telegraf/typings/composer'
import { SceneGlobalActionsFn } from '../../middleware-utils'

type ContextMessageUpdateWithI18N = ContextMessageUpdate & { i18nScene: string }

function sceneId(ctx: ContextMessageUpdate & { i18nScene: string }) {
    if (ctx.scene?.current?.id !== undefined) {
        return ctx.scene.current.id
    } else if (ctx.i18nScene !== undefined) {
        return ctx.i18nScene
    } else {
        throw Error('Could not find scene id. Is this scene wrapped?')
    }
}

const addi18nMethodsMiddleware = async (ctx: ContextMessageUpdateWithI18N, next: () => Promise<void>) => {

    ctx.i18Btn = (id: string, tplData: object = undefined) =>
        ctx.i18n.t(`scenes.${sceneId(ctx)}.keyboard.${id}`, tplData)

    ctx.i18SharedBtn = (id: string, tplData: object = undefined) =>
        ctx.i18n.t(`shared.keyboard.${id}`, tplData)

    ctx.i18Msg = (id: string, tplData: object = undefined, byDefault: string | null = undefined) => {
        const resourceKey = `scenes.${sceneId(ctx)}.${id}`
        if (byDefault === undefined || i18n.resourceKeys('ru').includes(resourceKey)) {
            return ctx.i18n.t(resourceKey, tplData)
        } else {
            return byDefault
        }
    }
    return await next()
}

export const i18nWrapSceneContext = (sceneId: string, globalRegisterFn: SceneGlobalActionsFn): MiddlewareFn<ContextMessageUpdate> => {
    const composer = new Composer()

    const middleware = async (ctx: ContextMessageUpdateWithI18N, next: () => Promise<void>) => {
        try {
            ctx.i18nScene = sceneId
            await composer.middleware()(ctx, () => Promise.resolve())
        } finally {
            ctx.i18nScene = undefined
        }

        await next()
    }

    globalRegisterFn(composer)

    return middleware
}


export const i18nMiddleware = Composer.compose([i18n.middleware(), addi18nMethodsMiddleware])