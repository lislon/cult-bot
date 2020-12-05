import { BaseScene, Composer, Extra, Markup } from 'telegraf'
import { allCategories, ContextMessageUpdate, EventCategory } from '../../interfaces/app-interfaces'
import { i18nSceneHelper, isAdmin, sleep } from '../../util/scene-helper'
import { cardFormat } from '../shared/card-format'
import {
    getGoogleSpreadSheetURL,
    getNextWeekEndRange,
    ruFormat,
    showBotVersion,
    warnAdminIfDateIsOverriden
} from '../shared/shared-logic'
import { db, pgLogOnlyErrors, pgLogVerbose } from '../../database/db'
import { Paging } from '../shared/paging'
import { isValid, parse, parseISO, subSeconds } from 'date-fns'
import { CallbackButton, InlineKeyboardButton } from 'telegraf/typings/markup'
import { StatByCat, StatByReviewer } from '../../database/db-admin'
import { addMonths } from 'date-fns/fp'
import { SceneRegister } from '../../middleware-utils'
import { logger } from '../../util/logger'
import dbsync from '../../dbsync/dbsync'
import { STICKER_CAT_THUMBS_UP } from '../../util/stickers'
import { WrongExcelColumnsError } from '../../dbsync/WrongFormatException'
import { EventToSave } from '../../interfaces/db-interfaces'
import { chunkString } from '../../util/chunk-split'

const POSTS_PER_PAGE_ADMIN = 10

const scene = new BaseScene<ContextMessageUpdate>('admin_scene');

export interface AdminSceneState {
    cat?: EventCategory,
    reviewer?: string,
    overrideDate?: string
}

const {actionName, i18SharedBtn, i18Btn, i18Msg} = i18nSceneHelper(scene)

const menuCats = [
    ['theaters', 'exhibitions'],
    ['movies', 'events'],
    ['walks', 'concerts']
]

function addReviewersMenu(statsByReviewer: StatByReviewer[], ctx: ContextMessageUpdate) {
    const btn = []
    let thisRow: CallbackButton[] = []
    statsByReviewer.forEach(({reviewer, count}) => {
        const icon = i18Msg(ctx, `admin_icons.${reviewer}`, undefined, '') || i18Msg(ctx, 'admin_icons.default')
        thisRow.push(Markup.callbackButton(i18Btn(ctx, 'byReviewer', {
            count,
            icon,
            reviewer
        }), actionName(`r_${reviewer}`)))
        if (thisRow.length == 2) {
            btn.push(thisRow)
            thisRow = []
        }
    })
    if (thisRow.length > 0) {
        btn.push(thisRow)
    }
    return btn
}

const content = async (ctx: ContextMessageUpdate) => {
    const dateRanges = getNextWeekEndRange(ctx.now())

    const statsByName: StatByCat[] = await db.repoAdmin.findChangedEventsByCatStats(dateRanges)

    let adminButtons: CallbackButton[][] = []

    adminButtons = [...adminButtons, [Markup.callbackButton(i18Btn(ctx, 'menu_changed_snapshot'), 'fake')]]

    adminButtons = [...adminButtons, ...await menuCats.map(row =>
        row.map(btnName => {
            const count = statsByName.find(r => r.category === btnName)
            return Markup.callbackButton(i18Btn(ctx, btnName, {count: count === undefined ? 0 : count.count}), actionName(btnName));
        })
    )]

    adminButtons = [...adminButtons, [Markup.callbackButton(i18Btn(ctx, 'menu_per_names'), 'fake')]]

    const statsByReviewer = await db.repoAdmin.findStatsByReviewer(dateRanges)
    adminButtons = [...adminButtons, ...addReviewersMenu(statsByReviewer, ctx)]

    adminButtons = [...adminButtons, [Markup.callbackButton(i18Btn(ctx, 'menu_actions'), 'fake')]]

    adminButtons.push([
        Markup.callbackButton(i18Btn(ctx, 'sync'), actionName('sync')),
        Markup.callbackButton(i18Btn(ctx, 'version'), actionName('version')),
    ])
    adminButtons.push([Markup.callbackButton(i18SharedBtn(ctx, 'back'), actionName('back'))])

    return {
        msg: i18Msg(ctx, 'welcome', {
            start: ruFormat(dateRanges.start, 'dd MMMM HH:mm'),
            end: ruFormat(subSeconds(dateRanges.end, 1), 'dd MMMM HH:mm')
        }),
        markup: Extra.HTML().markup(Markup.inlineKeyboard(adminButtons))
    }
}

async function replyWithHTMLMaybeChunk(ctx: ContextMessageUpdate, msg: string) {
    const MAX_TELEGRAM_MESSAGE_LENGTH = 4096
    const chunks: string[] = chunkString(msg, MAX_TELEGRAM_MESSAGE_LENGTH)
    for (const msg of chunks) {
        await ctx.replyWithHTML(msg)
    }
}

export async function synchronizeDbByUser(ctx: ContextMessageUpdate) {
    await ctx.replyWithHTML(i18Msg(ctx, 'start_sync', {url: getGoogleSpreadSheetURL()}), {
        disable_web_page_preview: true
    })
    try {
        const {syncResult, errors} = await dbsync(db)
        // await ctx.replyWithHTML(i18Msg(ctx, 'sync_success', {updated, errors}))

        const totalErrors = errors.reduce((total, e) => total + e.extIds.length, 0)

        const formatBody = () => {
            const s = allCategories
                .map(cat => {
                    const inserted = syncResult.insertedEvents.filter(e => e.primaryData.category === cat)
                    const updated = syncResult.updatedEvents.filter(e => e.primaryData.category === cat)
                    const deleted = syncResult.deletedEvents.filter(e => e.category === cat)
                    return {cat, inserted, updated, deleted}
                })
                .filter(({inserted, updated, deleted}) => {
                    return inserted.length + updated.length + deleted.length > 0
                })
                .map(({cat, inserted, updated, deleted}) => {
                    let rows: string[] = [
                        i18Msg(ctx, `sync_stats_cat_header`, {
                            icon: i18Msg(ctx, 'sync_stats_category_icons.' + cat),
                            categoryTitle: i18Msg(ctx, 'sync_stats_category_titles.' + cat)
                        })
                    ]

                    if (inserted.length > 0) {
                        rows = [...rows, ...inserted.map((i: EventToSave) => i18Msg(ctx, 'sync_stats_cat_item_inserted', {
                            ext_id: i.primaryData.ext_id,
                            title: i.primaryData.title
                        }))]
                    }
                    if (updated.length > 0) {
                        rows = [...rows, ...updated.map((i: EventToSave) => i18Msg(ctx, 'sync_stats_cat_item_updated', {
                            ext_id: i.primaryData.ext_id,
                            title: i.primaryData.title
                        }))]
                    }
                    if (deleted.length > 0) {
                        rows = [...rows, ...deleted.map(i => i18Msg(ctx, 'sync_stats_cat_item_deleted', {
                            ext_id: i.ext_id,
                            title: i.title
                        }))]
                    }
                    return rows.join('\n')
                }).join('\n\n')
            if (s.length === 0) {
                return ' - ничего нового с момента последней синхронизации'
            } else {
                return `\n\n${s}`
            }
        }

        const formatErrors = () => {
            return i18Msg(ctx, 'sync_error_title', {
                totalErrors: totalErrors,
                errors: errors
                    .filter(e => e.extIds.length > 0)
                    .map(e => i18Msg(ctx, 'sync_error_row', {
                        sheetName: e.sheetName,
                        extIds: e.extIds.join(', ')
                    }))
                    .join('\n')
            })
        }

        const dbTotalRows = await db.repoAdmin.countTotalRows()

        await replyWithHTMLMaybeChunk(ctx, i18Msg(ctx, `sync_stats_title`, {
            body: formatBody() + '\n' + (totalErrors > 0 ? formatErrors() : '✅ 0 Ошибок'),
            rows: dbTotalRows
        }))

        if (totalErrors === 0) {
            await sleep(500)
            await ctx.replyWithSticker(STICKER_CAT_THUMBS_UP)
        }
    } catch (e) {
        if (e instanceof WrongExcelColumnsError) {
            await ctx.reply(i18Msg(ctx, 'sync_wrong_format', e.data))
        } else {
            await ctx.reply(i18Msg(ctx, 'sync_error', {error: e.toString().substr(0, 100)}))
            throw e
        }
    }
}

scene
    .use(async (ctx: ContextMessageUpdate, next: () => Promise<void>) => {
        if (!isAdmin(ctx)) {
            logger.warn('User is not more admin. Rederict it to main_scene')
            await ctx.scene.enter('main_scene')
        } else {
            await next()
        }
    })
    .enter(async (ctx: ContextMessageUpdate) => {
        await prepareSessionStateIfNeeded(ctx)
        const {msg, markup} = await content(ctx)
        await ctx.replyWithMarkdown(msg, markup)
    })
    .use(Paging.pagingMiddleware(actionName('show_more'),
        async (ctx: ContextMessageUpdate) => {
            Paging.increment(ctx, POSTS_PER_PAGE_ADMIN)
            await showNextResults(ctx)
            await ctx.answerCbQuery()
        }))
    .action(actionName('sync'), async (ctx: ContextMessageUpdate) => {
        await ctx.answerCbQuery()
        await synchronizeDbByUser(ctx)
    })
    .action(actionName('version'), async (ctx: ContextMessageUpdate) => {
        await ctx.answerCbQuery()
        await showBotVersion(ctx)
    })
    .action(new RegExp(`${actionName('r_')}(.+)`), async (ctx: ContextMessageUpdate) => {
        // db.repoAdmin.findAllEventsByReviewer(ctx.match[1], getNextWeekEndRange(ctx.now()), )
        await ctx.answerCbQuery()
        await startNewPaging(ctx)
        ctx.session.adminScene.reviewer = ctx.match[1]
        await showNextResults(ctx)
    })
    .action('fake', async (ctx) => await ctx.answerCbQuery(i18Msg(ctx, 'just_a_button')))

menuCats.flatMap(m => m).forEach(menuItem => {
    scene.action(actionName(menuItem), async (ctx: ContextMessageUpdate) => {
        await ctx.answerCbQuery()
        await startNewPaging(ctx)
        ctx.session.adminScene.cat = menuItem as EventCategory
        await showNextResults(ctx)
    })
})

async function getSearchedEvents(ctx: ContextMessageUpdate) {
    const nextWeekEndRange = getNextWeekEndRange(ctx.now())
    if (ctx.session.adminScene.cat !== undefined) {
        const stats: StatByCat[] = await db.repoAdmin.findChangedEventsByCatStats(nextWeekEndRange)
        const total = stats.find(r => r.category === ctx.session.adminScene.cat).count
        const events = await db.repoAdmin.findAllChangedEventsByCat(ctx.session.adminScene.cat, nextWeekEndRange, POSTS_PER_PAGE_ADMIN, ctx.session.paging.pagingOffset)
        return {total, events}
    } else {
        const stats = await db.repoAdmin.findStatsByReviewer(nextWeekEndRange)
        const total = stats.find(r => r.reviewer === ctx.session.adminScene.reviewer).count
        const events = await db.repoAdmin.findAllEventsByReviewer(ctx.session.adminScene.reviewer, nextWeekEndRange, POSTS_PER_PAGE_ADMIN, ctx.session.paging.pagingOffset)
        return {total, events}
    }
}

function getButtonsSwitch(ctx: ContextMessageUpdate, eventId: number, active: 'snapshot' | 'current' = 'current') {
    return [Markup.callbackButton(
        i18Btn(ctx, `switch_to_snapshot`,
            {active_icon: active === 'snapshot' ? i18Btn(ctx, 'snapshot_active_icon') : ''}
        ),
        actionName(`snapshot_${eventId}`)),
        Markup.callbackButton(
            i18Btn(ctx, 'switch_to_current',
                {active_icon: active === 'current' ? i18Btn(ctx, 'current_active_icon') : ''}
            ),
            actionName(`current_${eventId}`))
    ]
}

async function showNextResults(ctx: ContextMessageUpdate) {
    await prepareSessionStateIfNeeded(ctx)
    const {total, events} = await getSearchedEvents(ctx)

    const showMoreBtn = Markup.callbackButton(i18Btn(ctx, 'show_more', {
        page: Math.ceil(ctx.session.paging.pagingOffset / POSTS_PER_PAGE_ADMIN) + 1,
        total: Math.ceil(+total / POSTS_PER_PAGE_ADMIN)
    }), actionName('show_more'))

    let count = 0
    for (const event of events) {

        let buttons: InlineKeyboardButton[][] = []

        if (event.snapshotStatus === 'updated') {
            buttons = [...buttons,
                getButtonsSwitch(ctx, event.id, 'current')
            ]
        }

        if (++count == events.length && events.length === POSTS_PER_PAGE_ADMIN) {
            buttons = [...buttons, [showMoreBtn]]
        }

        await ctx.replyWithHTML(cardFormat(event, {showAdminInfo: true}), {
            disable_web_page_preview: true,
            reply_markup: buttons.length > 0 ? Markup.inlineKeyboard(buttons) : undefined
        })
        await sleep(200)
    }
}


async function startNewPaging(ctx: ContextMessageUpdate) {
    await prepareSessionStateIfNeeded(ctx)
    ctx.session.adminScene.cat = undefined
    ctx.session.adminScene.reviewer = undefined
    Paging.reset(ctx)
    await warnAdminIfDateIsOverriden(ctx)
}

async function prepareSessionStateIfNeeded(ctx: ContextMessageUpdate) {
    if (!ctx.scene.current) {
        await ctx.scene.enter('admin_scene', undefined, true)
    }
    Paging.prepareSession(ctx)
    if (ctx.session.adminScene === undefined) {
        ctx.session.adminScene = {
            cat: undefined,
            reviewer: undefined,
            overrideDate: undefined
        }
    }
}

function findExistingButtonRow(ctx: ContextMessageUpdate, predicate: (btn: CallbackButton) => boolean): CallbackButton[] {
    const existingKeyboard = (ctx as any).update?.callback_query?.message?.reply_markup?.inline_keyboard as CallbackButton[][]
    return existingKeyboard?.find(btns => btns.find(predicate) !== undefined)
}

async function switchCard(ctx: ContextMessageUpdate, version: 'current'|'snapshot') {
    const eventId = +ctx.match[1]
    await ctx.answerCbQuery()
    const event = await db.repoAdmin.findSnapshotEvent(eventId, version)
    const existingKeyboard = findExistingButtonRow(ctx, btn => btn.callback_data === actionName('show_more'))
    const buttons = [getButtonsSwitch(ctx, eventId, version), ...(existingKeyboard ? [existingKeyboard] : [])]
    await ctx.editMessageText(cardFormat(event, {showAdminInfo: true}),
        Extra.HTML().markup(Markup.inlineKeyboard(buttons)).webPreview(false))
}

function globalActionsFn(bot: Composer<ContextMessageUpdate>) {
    const adminGlobalCommands = new Composer<ContextMessageUpdate>()
        .command('adminGlobalCommands', async (ctx: ContextMessageUpdate) => {
            await ctx.scene.enter('admin_scene');
        })
        .command('time_now', async (ctx: ContextMessageUpdate) => {
            ctx.session.adminScene.overrideDate = undefined
            await ctx.replyWithHTML(i18Msg(ctx, 'time_override.reset'))
        })
        .command('time', async (ctx: ContextMessageUpdate) => {
            const HUMAN_OVERRIDE_FORMAT = 'dd MMMM yyyy HH:mm, iiii'

            await prepareSessionStateIfNeeded(ctx)
            const dateStr = ctx.message.text.replace(/^\/time[\s]*/, '')
            if (dateStr === undefined || dateStr === 'now') {
                ctx.session.adminScene.overrideDate = undefined
                await ctx.replyWithHTML(i18Msg(ctx, 'time_override.reset'))
            } else if (dateStr === '') {
                await ctx.replyWithHTML(i18Msg(ctx, 'time_override.status',
                    {
                        time: ruFormat(
                            (ctx.session.adminScene.overrideDate
                                ? parseISO(ctx.session.adminScene.overrideDate)
                                : new Date())
                            , HUMAN_OVERRIDE_FORMAT)
                    }))
            } else {
                const now = new Date()
                let parsed = parse(dateStr, 'yyyy-MM-dd HH:mm', now)

                if (!isValid(parsed) && dateStr.match(/^\d{1,2}$/)) {
                    parsed = new Date(now.getFullYear(), now.getMonth(), +dateStr)
                    if (now.getDay() > +dateStr) {
                        parsed = addMonths(1)(parsed)
                    }
                } else if (!isValid(parsed)) {
                    parsed = undefined
                }
                if (parsed !== undefined) {
                    ctx.session.adminScene.overrideDate = parsed.toISOString()
                    await ctx.replyWithHTML(i18Msg(ctx, 'time_override.changed', {time: ruFormat(parsed, HUMAN_OVERRIDE_FORMAT)}))
                } else {
                    await ctx.replyWithHTML(i18Msg(ctx, 'time_override.invalid'))
                }
            }
        })
        .command('version', async (ctx) => {
            await showBotVersion(ctx)
        })
        .command('sync', async (ctx) => {
            await synchronizeDbByUser(ctx)
        })
        .command(['log', 'level'], async (ctx) => {
            await ctx.replyWithHTML(i18Msg(ctx, 'select_log_level'))
        })
        .command('snapshot', async (ctx) => {
            await db.repoSnapshot.takeSnapshot()
            await ctx.replyWithHTML(i18Msg(ctx, 'snapshot_taken'))
        })
        .command(['level_silly', 'level_debug', 'level_error'], async (ctx) => {
            logger.level = ctx.message.text.replace(/^\/[^_]+_/, '')
            await ctx.replyWithHTML(i18Msg(ctx, 'log_level_selected', {level: logger.level}))
            if (logger.level === 'silly') {
                pgLogVerbose()
            } else {
                pgLogOnlyErrors()
            }
        })
        .action(/admin_scene[.]snapshot_(\d+)$/, async (ctx) => {
            await switchCard(ctx, 'snapshot')
        })
        .action(/admin_scene[.]current_(\d+)$/, async (ctx) => {
            await switchCard(ctx, 'current')
        })

    bot.use(Composer.optional(ctx => isAdmin(ctx), adminGlobalCommands))
}

export const adminScene = {
    scene,
    globalActionsFn
} as SceneRegister
