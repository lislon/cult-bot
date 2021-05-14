import { Composer, Markup, Scenes } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { i18nSceneHelper, ifAdmin, isAdmin, sleep } from '../../util/scene-helper'
import { SceneRegister } from '../../middleware-utils'
import { botConfig } from '../../util/bot-config'
import { db } from '../../database/db'
import {
    extraInlineMenu,
    generatePlural,
    getInlineKeyboardFromCallbackQuery,
    getNextWeekendRange,
    isEventEndsInFuture,
    mySlugify,
    updateKeyboardButtons
} from '../shared/shared-logic'
import { getLikesRow } from '../likes/likes-common'
import { cardFormat } from '../shared/card-format'
import { User } from 'typegram/manage'
import { analyticRecordEventView, googleAnalyticRecordReferral } from '../../lib/middleware/analytics-middleware'
import { parseAndPredictTimetable } from '../../lib/timetable/timetable-utils'
import { KeyboardButton } from 'typegram'
import { displayPackMenu, displayPackMenuFromStart } from '../packs/packs-menu'
import { getNextRangeForPacks } from '../packs/packs-common'

const scene = new Scenes.BaseScene<ContextMessageUpdate>('main_scene')

const {i18nModuleBtnName, i18Btn, i18Msg} = i18nSceneHelper(scene)

const quick = botConfig.NODE_ENV === 'test'
export type MainSceneEnterState = { override_main_scene_msg?: string }

const content = (ctx: ContextMessageUpdate) => {
    const menu = [
        ['customize'],
        ['tops', 'packs'],
        ...[(isAdmin(ctx) ? ['search', 'admin'] : ['search'])],
        ['feedback', 'favorites'],
    ]


    const mainButtons: KeyboardButton[][] = menu.map(row =>
        row.map(btnName => {
            return Markup.button.text(i18Btn(ctx, btnName))
        })
    )
    if (botConfig.FEATURE_GEO) {
        const text = i18Btn(ctx, 'near_me')
        mainButtons.push([Markup.button.locationRequest(text)])
    }

    const state = ctx.scene.state as MainSceneEnterState
    return {
        msg: state.override_main_scene_msg ? state.override_main_scene_msg : i18Msg(ctx, 'select_anything'),
        markupMainMenu: Markup.keyboard(mainButtons).resize()
    }
}

scene
    .enter(async ctx => {
        const {msg, markupMainMenu} = content(ctx)

        await ctx.replyWithHTML(msg, markupMainMenu)

        ctx.ua.pv({dp: '/', dt: 'Главное меню'})
    })

function postStageActionsFn(bot: Composer<ContextMessageUpdate>): void {
    bot
        // .use(middlewares.logMiddleware('postStageActionsFn scene: ' + scene.id))
        .hears(i18nModuleBtnName('tops'), async ctx => {
            await ctx.scene.enter('tops_scene')
        })
        .hears(/.{1,4}Подборки$/, async ctx => {
            await ctx.scene.enter('packs_scene')
        })
        .hears(i18nModuleBtnName('search'), async ctx => {
            await ctx.scene.enter('search_scene')
        })
        .hears(i18nModuleBtnName('customize'), async ctx => {
            await ctx.scene.enter('customize_scene')
        })
        .hears(i18nModuleBtnName('feedback'), async ctx => {
            await ctx.scene.enter('feedback_scene')
        })
        .hears(i18nModuleBtnName('favorites'), async ctx => {
            await ctx.scene.enter('favorites_scene')
        })
        .hears(i18nModuleBtnName('admin'), async ctx => {
            await ifAdmin(ctx, () => ctx.scene.enter('admin_scene'))
        })
        .action('back_as_new', async ctx => {
            await ctx.answerCbQuery()
            const keyboardWithoutBackButton = await updateKeyboardButtons(getInlineKeyboardFromCallbackQuery(ctx), /back_as_new/, () => {
                return undefined
            })

            try {
                await ctx.editMessageReplyMarkup(Markup.inlineKeyboard(keyboardWithoutBackButton.inline_keyboard).reply_markup)
            } catch (e) {
                ctx.logger.warn('error when click on on start button: ', e)
            }
            await showWelcomeScene(ctx, ctx.callbackQuery)
        })
}

async function showWelcomeScene(ctx: ContextMessageUpdate, message: { from?: User }) {
    const name = message.from?.first_name ?? undefined
    if (!quick) await sleep(500)

    try {
        const count = await db.repoEventsCommon.countEvents({
            interval: getNextWeekendRange(ctx.now())
        })
        await ctx.replyWithHTML(ctx.i18n.t('root.welcome1', {
            welcome_name: ctx.i18n.t(name ? 'root.welcome_with_name' : 'root.welcome_without_name', {name}),
            eventPlural: generatePlural(ctx, 'event_prepositional', count)
        }))
    } catch (e) {
        ctx.logger.error(e)
    }
    if (!quick) await sleep(1000)

    await ctx.scene.enter('main_scene', {override_main_scene_msg: ctx.i18n.t('root.welcome2')})
}

async function showDirectMessage(ctx: ContextMessageUpdate, extId: string) {
    const event = await db.repoEventsCommon.getEventsByExtId(extId)
    if (event !== undefined) {

        const parsedTimetable = parseAndPredictTimetable(event.timetable, ctx.now(), botConfig)


        const likesRow = getLikesRow(ctx, event)

        const startUsingBot = Markup.button.callback(i18Btn(ctx, 'back_as_new'), 'back_as_new')
        await ctx.replyWithHTML(cardFormat({
            ...event,
            isFuture: isEventEndsInFuture(parsedTimetable.predictedIntervals, ctx.now())
        }, {now: ctx.now()}), extraInlineMenu([likesRow, [startUsingBot]]))
        analyticRecordEventView(ctx, event)
        ctx.ua.pv({
            dp: `/start-event/${mySlugify(event.extId)}`,
            dt: `Прямая ссылка > ${event.title}`
        })
    } else {
        ctx.logger.warn(`start event with id '${extId}' is not found. fallback.`)
        await showWelcomeScene(ctx, ctx.message)
    }
}

async function showDirectPack(ctx: ContextMessageUpdate, extId: string) {
    const packInfo = await db.repoPacks.getActivePackInfoByExtId({
        extId,
        interval: getNextRangeForPacks(ctx.now())
    })

    if (packInfo !== undefined) {
        await displayPackMenuFromStart(ctx, packInfo.id)

        ctx.ua.pv({
            dp: `/start-pack/${mySlugify(extId)}`,
            dt: `Прямая ссылка > ${packInfo.title}`
        })

    } else {
        ctx.logger.warn(`pack with id '${extId}' is not found. fallback.`)
        await showWelcomeScene(ctx, ctx.message)
    }
}


function preStageGlobalActionsFn(bot: Composer<ContextMessageUpdate>): void {
    bot.start(async (ctx: ContextMessageUpdate & { startPayload: string }) => {
        ctx.logger.debug([
            `/start`,
            `id=${ctx.from.id}`,
            `first_name=${ctx.from.first_name}`,
            `last_name=${ctx.from.last_name}`,
            `username=${ctx.from.username}`,
            `startPayload=${ctx.startPayload}`,
            `ua_uuid=${ctx.session.user.uaUuid}`].join(' '))

        const [source, oldRedirectPart] = ctx.startPayload.split('_').filter(s => s !== '')
        const oldRedirect = oldRedirectPart?.match(/event-(.+)$/)?.[1] || ''
        let newRedirect = ''

        if (source !== '') {
            ctx.ua.set('cm', 'referral')

            try {
                const referralInfo = await db.repoReferral.loadByCode(source)
                if (referralInfo !== undefined) {
                    googleAnalyticRecordReferral(ctx, referralInfo.gaSource)
                    newRedirect = referralInfo.redirect

                    await db.repoReferralVisit.insert({
                        visitAt: new Date(),
                        referralId: referralInfo.id,
                        userId: ctx.session.user.id
                    })
                } else {
                    googleAnalyticRecordReferral(ctx, source)
                }
            } catch (e) {
                ctx.ua.set('cs', 'error-fallback')
                ctx.logger.error(e)
            }
        }

        if (oldRedirect !== '') {
            await showDirectMessage(ctx, oldRedirect)
        } else if (newRedirect.startsWith('G')) {
            await showDirectPack(ctx, newRedirect)
        } else if (newRedirect !== '') {
            await showDirectMessage(ctx, newRedirect)
        } else {
            await showWelcomeScene(ctx, ctx.message)
        }
    })
}

export const mainScene: SceneRegister = {
    scene,
    preStageGlobalActionsFn,
    postStageActionsFn
}