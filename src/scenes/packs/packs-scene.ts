import { BaseScene, Composer, Extra, Markup } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { i18nSceneHelper } from '../../util/scene-helper'
import { i18n } from '../../util/i18n'
import { Paging } from '../shared/paging'
import { getNextWeekRange, limitEventsToPage } from '../shared/shared-logic'
import { SceneRegister } from '../../middleware-utils'
import { db } from '../../database/db'

export interface PacksSceneState {
}

const scene = new BaseScene<ContextMessageUpdate>('packs_scene');

const {sceneHelper, actionName, i18nModuleBtnName, i18Btn, i18Msg, backButton} = i18nSceneHelper(scene)

const content = async (ctx: ContextMessageUpdate) => {
    // const topLevelMenu = [
    //     ['back'],
    // ]
    //

    const packs = await db.repoPacks.listPacks({
        interval: getNextWeekRange(ctx.now())
    })


    const mainButtons = [
        ...packs.map(p => [Markup.callbackButton(p.title, `pack_${p.id}`)])
        , [backButton(ctx)]
    ]

    return {
        msg: i18Msg(ctx, 'welcome'),
        markupMainMenu: Extra.HTML(true).markup(Markup.keyboard(mainButtons).resize())
    }
}

async function prepareSessionStateIfNeeded(ctx: ContextMessageUpdate) {
    Paging.prepareSession(ctx)

    const {} = ctx.session.packsScene || {}

    ctx.session.packsScene = {}
}

scene
    .enter(async (ctx: ContextMessageUpdate) => {
        const {msg, markupMainMenu} = await content(ctx)
        await prepareSessionStateIfNeeded(ctx)
        Paging.reset(ctx)
        await ctx.replyWithMarkdown(msg, markupMainMenu)
        ctx.ua.pv({dp: '/packs/', dt: 'Подборки на неделю'})
    })
    .leave(async (ctx) => {
        ctx.session.packsScene = undefined
    })
    .use(Paging.pagingMiddleware(actionName('show_more'),
        async (ctx: ContextMessageUpdate) => {
            Paging.increment(ctx, limitEventsToPage)
            // const {events} = await getTopEvents(ctx)
            // await showNextPortionOfResults(ctx, events)
            // await ctx.editMessageReplyMarkup()
        }))
    .hears(i18n.t(`ru`, `shared.keyboard.back`), async (ctx: ContextMessageUpdate) => {
        await prepareSessionStateIfNeeded(ctx)
        await ctx.scene.enter('main_scene')
    });

function globalActionsFn(bot: Composer<ContextMessageUpdate>) {


}

export const packsScene = {
    scene,
    globalActionsFn
} as SceneRegister