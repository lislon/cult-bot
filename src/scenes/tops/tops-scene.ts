import { BaseScene, Composer, Extra, Markup } from 'telegraf'
import { CAT_NAMES, ContextMessageUpdate, Event, EventCategory, MyInterval } from '../../interfaces/app-interfaces'
import { i18nSceneHelper, sleep } from '../../util/scene-helper'
import { cardFormat } from '../shared/card-format'
import * as events from 'events'
import { i18n } from '../../util/i18n'
import { Paging } from '../shared/paging'
import { getNextWeekEndRange, limitEventsToPage, ruFormat, warnAdminIfDateIsOverriden } from '../shared/shared-logic'
import { subSeconds } from 'date-fns/fp'
import { getISODay, isSameMonth, startOfDay } from 'date-fns'
import { SceneRegister } from '../../middleware-utils'
import { db } from '../../database/db'
import { encodeTagsLevel1 } from '../../util/tag-level1-encoder'

type SubMenuVariants = 'exhibitions_temp' | 'exhibitions_perm'

export interface TopsSceneState {
    isWatchingEvents: boolean,
    isInSubMenu: boolean,
    cat: EventCategory
    submenuSelected: SubMenuVariants
}

const scene = new BaseScene<ContextMessageUpdate>('tops_scene');
const {sceneHelper, actionName, i18nModuleBtnName, i18Btn, i18Msg} = i18nSceneHelper(scene)


function getOblasti(ctx: ContextMessageUpdate) {
    if (ctx.session.topsScene.submenuSelected !== undefined) {
        return encodeTagsLevel1('exhibitions', [i18Msg(ctx, `exhibitions_tags.${ctx.session.topsScene.submenuSelected}`)])
    }
    return []
}

//     cat: EventCategory, fromDate: Date, offset: number = 0
async function getTopEvents(ctx: ContextMessageUpdate): Promise<{range: MyInterval, events: Event[]}> {
    const range = getNextWeekEndRange(ctx.now())
    const events = await db.repoTopEvents.getTop({
        category: ctx.session.topsScene.cat,
        interval: range,
        oblasti: getOblasti(ctx),
        limit: limitEventsToPage,
        offset: ctx.session.paging.pagingOffset })
    return {range, events}
}


const backMarkup = (ctx: ContextMessageUpdate) => {
    const {i18SharedBtn} = sceneHelper(ctx)

    const btn = Markup.button(i18SharedBtn('back'))

    return Markup.keyboard([btn]).resize()
}

const content = (ctx: ContextMessageUpdate) => {
    const topLevelMenu = [
        ['theaters', 'exhibitions'],
        ['movies', 'events'],
        ['walks', 'concerts'],
        ['back'],
    ]

    const mainButtons = topLevelMenu.map(row =>
        row.map(btnName => {
            return Markup.button(i18Btn(ctx, btnName));
        })
    );
    return {
        msg: i18Msg(ctx, 'select_category'),
        markupMainMenu: Extra.HTML(true).markup(Markup.keyboard(mainButtons).resize())
    }
}

async function prepareSessionStateIfNeeded(ctx: ContextMessageUpdate) {
    if (!ctx.scene.current) {
        await ctx.scene.enter('tops_scene', undefined, true)
    }
    Paging.prepareSession(ctx)

    const {
        isWatchingEvents,
        isInSubMenu,
        cat,
        submenuSelected,
    } = ctx.session.topsScene || {}

    ctx.session.topsScene = {
        isWatchingEvents: isWatchingEvents || false,
        isInSubMenu: isInSubMenu || false,
        cat: cat,
        submenuSelected,
    }
}

scene
    .enter(async (ctx: ContextMessageUpdate) => {
        const { msg, markupMainMenu} = content(ctx)
        await prepareSessionStateIfNeeded(ctx)
        Paging.reset(ctx)
        ctx.session.topsScene.isWatchingEvents = false
        ctx.session.topsScene.isInSubMenu = false

        await ctx.replyWithMarkdown(msg, markupMainMenu)
        ctx.ua.pv({ dp: '/top/', dt: 'Рубрики' })
    })
    .leave(async (ctx) => {
        ctx.session.topsScene = undefined
    })
    .use(Paging.pagingMiddleware(actionName('show_more'),
        async (ctx: ContextMessageUpdate) => {
            Paging.increment(ctx, limitEventsToPage)
            const {events} = await getTopEvents(ctx)
            await showNextPortionOfResults(ctx, events)
            await ctx.editMessageReplyMarkup()
        }))


function intervalTemplateNormalize(range: MyInterval): MyInterval {
    return {
        start: range.start,
        end: startOfDay(range.end).getTime() === range.end.getTime() ? subSeconds(1)(range.end) : range.end
    }
}

function intervalTemplateParams(range: MyInterval) {
    return {
        from: ruFormat(range.start, 'dd.MM HH:mm'),
        to: ruFormat(subSeconds(1)(range.end), 'dd.MM HH:mm')
    }
}

async function showExhibitionsSubMenu(ctx: ContextMessageUpdate) {
    const subMenu = [
        ['exhibitions_perm', 'exhibitions_temp'],
        ['back'],
    ]

    const buttons = subMenu.map(row =>
        row.map(btnName => {
            return Markup.button(i18Btn(ctx, btnName));
        })
    )

    await ctx.reply(i18Msg(ctx, 'select_category'),
        Extra.HTML().markup(Markup.keyboard(buttons).resize())
    )
}

async function showEventsFirstTime(ctx: ContextMessageUpdate) {
    const {range, events} = await getTopEvents(ctx)

    await warnAdminIfDateIsOverriden(ctx)

    const rangeN = intervalTemplateNormalize(range)

    if (events.length > 0) {
        const tplData = {
            cat: i18Msg(ctx, `keyboard.${ctx.session.topsScene.submenuSelected ? ctx.session.topsScene.submenuSelected : ctx.session.topsScene.cat}`)
        }

        let humanDateRange = ''
        if (isSameMonth(rangeN.start, range.end)) {
            humanDateRange = ruFormat(rangeN.start, 'dd') + '-' + ruFormat(rangeN.end, 'dd MMMM')
        } else {
            humanDateRange = ruFormat(rangeN.start, 'dd MMMM') + '-' + ruFormat(rangeN.end, 'dd MMMM')
        }

        let templateName

        if (getISODay(ctx.now()) === 6) {
            templateName = 'let_me_show_this_weekend_sat';
        } else if (getISODay(ctx.now()) === 7) {
            templateName = 'let_me_show_this_weekend_sun';
        } else {
            templateName = 'let_me_show_next_weekend';
        }

        await ctx.replyWithHTML(i18Msg(ctx, templateName, {humanDateRange, ...tplData}),
            {reply_markup: backMarkup(ctx)})

        await sleep(500)
        await showNextPortionOfResults(ctx, events)
    } else {
        await ctx.reply(i18Msg(ctx, 'nothing_found_in_interval', intervalTemplateParams(range)),
            Extra.HTML(true).markup(backMarkup(ctx))
        )
    }
}
async function showNextPortionOfResults(ctx: ContextMessageUpdate, events: Event[]) {
    const nextBtn = Markup.inlineKeyboard([
        Markup.callbackButton(i18Btn(ctx, 'show_more'), actionName('show_more'))
    ])

    const fireRating = 18
    const sortedByRating = events.filter(e => e.rating >= fireRating).sort(e => e.rating)

    let count = 0
    for (const event of events) {

        await ctx.replyWithHTML(cardFormat(event), {
            disable_web_page_preview: true,
            reply_markup: (++count === events.length ? nextBtn : undefined)
        })


        if (sortedByRating.length > 0 && sortedByRating[0] === event) {
            await ctx.replyWithHTML(i18Msg(ctx, 'its_fire'));
        }

        await sleep(300)
    }

    if (events.length === 0) {
        await ctx.reply(i18Msg(ctx, 'no_more_events'))
    }
}

scene.hears(i18n.t(`ru`, `shared.keyboard.back`), async (ctx: ContextMessageUpdate) => {
    await prepareSessionStateIfNeeded(ctx)
    if (ctx.session.topsScene.isWatchingEvents || ctx.session.topsScene.isInSubMenu) {
        await ctx.scene.enter('tops_scene')
    } else {
        await ctx.scene.enter('main_scene')
    }
});

function trackUa(ctx: ContextMessageUpdate) {
    const rubName = {
        'exhibitions_temp': 'Временные',
        'exhibitions_perm': 'Постояннные',
    }

    if (ctx.session.topsScene.submenuSelected !== undefined) {
        ctx.ua.pv({
            dp: `/top/${ctx.session.topsScene.cat}/${ctx.session.topsScene.submenuSelected.replace('exhibitions_', '')}/`,
            dt: `Рубрики > ${CAT_NAMES[ctx.session.topsScene.cat]} > ${rubName[ctx.session.topsScene.submenuSelected]}`
        })
    } else {
        ctx.ua.pv({ dp: `/top/${ctx.session.topsScene.cat}/`, dt: `Рубрики > ${CAT_NAMES[ctx.session.topsScene.cat]}` })
    }
}

function globalActionsFn(bot: Composer<ContextMessageUpdate>) {

    for (const cat of ['theaters', 'movies', 'events', 'walks', 'concerts', 'exhibitions_temp', 'exhibitions_perm']) {
        bot.hears(i18nModuleBtnName(cat), async (ctx: ContextMessageUpdate) => {
            await prepareSessionStateIfNeeded(ctx)
            if (cat === 'exhibitions_temp' || cat === 'exhibitions_perm') {
                ctx.session.topsScene.cat = 'exhibitions';
                ctx.session.topsScene.submenuSelected = cat
            } else {
                ctx.session.topsScene.cat = cat as EventCategory;
                ctx.session.topsScene.submenuSelected = undefined
            }
            ctx.session.topsScene.isWatchingEvents = true
            ctx.session.topsScene.isInSubMenu = false
            await showEventsFirstTime(ctx)
            trackUa(ctx)
        });
    }
    bot.hears(i18nModuleBtnName('exhibitions'), async (ctx: ContextMessageUpdate) => {
        await prepareSessionStateIfNeeded(ctx)
        ctx.session.topsScene.isInSubMenu = true
        ctx.session.topsScene.cat = 'exhibitions';
        await showExhibitionsSubMenu(ctx)
        trackUa(ctx)
    });
}

export const topsScene = {
    scene,
    globalActionsFn
} as SceneRegister