import { BaseScene, Composer, Extra, Markup } from 'telegraf'
import { ContextMessageUpdate, EventCategory } from '../../interfaces/app-interfaces'
import { i18nSceneHelper, isAdmin, sleep } from '../../util/scene-helper'
import { cardFormat } from '../shared/card-format'
import {
    getGoogleSpreadSheetURL,
    getNextWeekEndRange,
    ruFormat,
    showBotVersion,
    warnAdminIfDateIsOverriden
} from '../shared/shared-logic'
import { db, IExtensions, pgLogOnlyErrors, pgLogVerbose } from '../../database/db'
import { Paging } from '../shared/paging'
import { isValid, parse, parseISO } from 'date-fns'
import { CallbackButton, InlineKeyboardButton } from 'telegraf/typings/markup'
import { StatByCat } from '../../database/db-admin'
import { addMonths } from 'date-fns/fp'
import { SceneRegister } from '../../middleware-utils'
import { logger, loggerTransport } from '../../util/logger'
import { STICKER_CAT_THUMBS_UP } from '../../util/stickers'
import { WrongExcelColumnsError } from '../../dbsync/WrongFormatException'
import { EventToSave } from '../../interfaces/db-interfaces'
import { chunkString } from '../../util/chunk-split'
import { formatMainAdminMenu, formatMessageForSyncReport } from './admin-format'
import { menuCats, POSTS_PER_PAGE_ADMIN, SYNC_CONFIRM_TIMEOUT_SECONDS, totalValidationErrors } from './admin-common'
import { ExtraReplyMessage } from 'telegraf/typings/telegram-types'
import { Message, User } from 'telegram-typings'
import { SyncDiff } from '../../database/db-sync-repository'
import { ITask } from 'pg-promise'
import { parseAndValidateGoogleSpreadsheets } from '../../dbsync/parserSpresdsheetEvents'
import { authToExcel } from '../../dbsync/googlesheets'
import Timeout = NodeJS.Timeout
import { EventPackValidated, getOnlyValid, prepareForPacksSync } from '../../dbsync/packsSyncLogic'
import { EventPackForSave } from '../../database/db-packs'

const scene = new BaseScene<ContextMessageUpdate>('admin_scene');

export interface AdminSceneState {
    cat?: EventCategory,
    reviewer?: string,
    overrideDate?: string
}

const {actionName, i18SharedBtn, i18Btn, i18Msg} = i18nSceneHelper(scene)

async function replyWithHTMLMaybeChunk(ctx: ContextMessageUpdate, msg: string, extra?: ExtraReplyMessage) {
    const MAX_TELEGRAM_MESSAGE_LENGTH = 4096
    const chunks: string[] = chunkString(msg, MAX_TELEGRAM_MESSAGE_LENGTH)

    let last: Message = undefined
    for (let i = 0; i < chunks.length; i++) {
        last = await ctx.replyWithHTML(chunks[i], i === chunks.length - 1 ? extra : {disable_notification: true})
    }
    return last
}

function listExtIds(eventToSaves: EventToSave[]): string {
    return eventToSaves.map(z => z.primaryData.ext_id).join(',')
}

function getUserFromCtx(ctx: ContextMessageUpdate): User {
    if (ctx.update.message !== undefined) {
        return ctx.update.message.from
    }
    return ctx.update.callback_query.from
}

function getHumanReadableUsername(user: User): string {
    return user.first_name || user.last_name || user.username || user.id + ''
}

export async function synchronizeDbByUser(ctx: ContextMessageUpdate) {
    const oldUser = GLOBAL_SYNC_STATE.lockOnSync(ctx)
    if (oldUser !== undefined) {
        await ctx.replyWithHTML(i18Msg(ctx, 'sync_is_locked',
            {user: getHumanReadableUsername(oldUser)}))
        return
    }

    try {

        await ctx.replyWithHTML(i18Msg(ctx, 'sync_start', {url: getGoogleSpreadSheetURL()}), {
            disable_web_page_preview: true
        })

        const excel = await authToExcel()
        const syncResult = await parseAndValidateGoogleSpreadsheets(db, excel)
        // const {validationErrors, rows, excelUpdater} = await parseAndValidateGoogleSpreadsheets()

        const {dbDiff, askUserToConfirm, eventPacks} = await db.tx('sync', async (dbTx) => {

            const dbDiff = await dbTx.repoSync.prepareDiffForSync(syncResult.rawEvents, dbTx)

            const eventPacks = await prepareForPacksSync(excel)

            GLOBAL_SYNC_STATE.chargeEventsSync(dbDiff, getOnlyValid(eventPacks))

            const askUserToConfirm = dbDiff.deletedEvents.length > 0
            if (askUserToConfirm === false) {
                await GLOBAL_SYNC_STATE.executeSync(dbTx)
            }
            return {dbDiff, askUserToConfirm, eventPacks}
        })

        const body = await formatMessageForSyncReport(syncResult.errors, dbDiff, eventPacks, ctx)
        if (askUserToConfirm === true) {
            const keyboard = [[
                Markup.callbackButton(i18Btn(ctx, 'sync_back'), actionName('sync_back')),
                Markup.callbackButton(i18Btn(ctx, 'sync_confirm'), actionName('sync_confirm')),
            ]]
            const msgId = await replyWithHTMLMaybeChunk(ctx, i18Msg(ctx, 'sync_ask_user_to_confirm', {
                body
            }), Extra.HTML().markup(Markup.inlineKeyboard(keyboard)))

            GLOBAL_SYNC_STATE.saveConfirmIdMessage(msgId)

        } else {

            logger.info([
                `Database updated.`,
                `Insertion done.`,
                `inserted={${listExtIds(dbDiff.insertedEvents)}}`,
                `updated={${listExtIds(dbDiff.updatedEvents)}}`,
                `deleted={${dbDiff.deletedEvents.map(d => d.ext_id).join(',')}}`
            ].join(' '));

            const msg = i18Msg(ctx, `sync_stats_title`, {
                body,
                rows: await db.repoAdmin.countTotalRows()
            })

            await replyWithHTMLMaybeChunk(ctx, msg)

            const isSomethingChanged = dbDiff.deletedEvents.length
                + dbDiff.insertedEvents.length
                + dbDiff.updatedEvents.length > 0
            if (totalValidationErrors(syncResult.errors) === 0 && isSomethingChanged) {
                await sleep(500)
                await ctx.replyWithSticker(STICKER_CAT_THUMBS_UP)
            }
        }
    } catch (e) {
        if (e instanceof WrongExcelColumnsError) {
            await ctx.replyWithHTML(i18Msg(ctx, 'sync_wrong_format', e.data))
        } else {
            await ctx.replyWithHTML(i18Msg(ctx, 'sync_error', {error: e.toString().substr(0, 100)}))
            throw e
        }
    }
}

class GlobalSync {
    private timeoutId: Timeout
    private syncDiff: SyncDiff
    private eventPacks: EventPackForSave[]
    private confirmIdMsg: Message
    private user: User

    public async executeSync(dbTx: ITask<IExtensions> & IExtensions) {
        logger.debug('hasData?', this.syncDiff !== undefined)
        this.stopOldTimerIfExists()
        try {
            logger.debug('hasData?', this.syncDiff !== undefined)
            await dbTx.repoSync.syncDiff(this.syncDiff, dbTx)

            await db.repoPacks.sync(this.eventPacks)

            logger.debug('Sync done')
        } finally {
            this.cleanup()
        }
    }

    public abort() {
        this.stopOldTimerIfExists()
        this.cleanup()
        logger.debug('Abort done')
    }

    private cleanup() {
        this.syncDiff = undefined
        this.user = undefined
        this.confirmIdMsg = undefined
        this.eventPacks = undefined
    }

    public isRunning(ctx: ContextMessageUpdate) {
        const user = getUserFromCtx(ctx)
        return this.user?.id === user.id
    }

    private startTimer() {
        logger.debug('Start cancel timer')
        this.stopOldTimerIfExists()
        this.cleanup()
        this.timeoutId = setTimeout(() => {
            logger.debug('Timer hit')
            this.timeoutId = undefined
            this.abort()
        }, SYNC_CONFIRM_TIMEOUT_SECONDS * 1000)
    }

    private stopOldTimerIfExists() {
        if (this.timeoutId !== undefined) {
            logger.debug('Stop timer')
            clearTimeout(this.timeoutId)
        }
    }

    lockOnSync(ctx: ContextMessageUpdate): User {
        const user = getUserFromCtx(ctx)
        if (this.user === undefined || this.user.id === user.id) {
            this.startTimer()
            this.user = user
            logger.debug('Lock done')
            return undefined
        }
        logger.debug('Lock fail')
        return this.user
    }

    chargeEventsSync(dbDiff: SyncDiff, eventPacks: EventPackForSave[]) {
        logger.debug('Charge')
        this.syncDiff = dbDiff
        this.eventPacks = eventPacks
    }

    saveConfirmIdMessage(msg: Message) {
        this.confirmIdMsg = msg
    }
}

const GLOBAL_SYNC_STATE = new GlobalSync()

scene
    .use(async (ctx: ContextMessageUpdate, next: () => Promise<void>) => {
        if (!isAdmin(ctx)) {
            logger.warn('User is not more admin. Redirect it to main_scene')
            await ctx.scene.enter('main_scene')
        } else {
            await next()
        }
    })
    .enter(async (ctx: ContextMessageUpdate) => {
        await prepareSessionStateIfNeeded(ctx)
        const {msg, markup} = await formatMainAdminMenu(ctx)
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
    .action(actionName('sync_back'), async (ctx: ContextMessageUpdate) => {
        await ctx.answerCbQuery()
        if (GLOBAL_SYNC_STATE.isRunning(ctx)) {
            GLOBAL_SYNC_STATE.abort()
            await ctx.editMessageReplyMarkup(Markup.inlineKeyboard([]))
            await ctx.replyWithHTML(i18Msg(ctx, 'sync_cancelled'))
        } else {
            await ctx.replyWithHTML(i18Msg(ctx, 'sync_no_transaction'))
        }
    })
    .action(actionName('sync_confirm'), async (ctx: ContextMessageUpdate) => {
        await ctx.answerCbQuery()
        if (GLOBAL_SYNC_STATE.isRunning(ctx)) {
            await db.tx(async (dbTx: ITask<IExtensions> & IExtensions) => {
                await GLOBAL_SYNC_STATE.executeSync(dbTx)
            })
            await ctx.editMessageReplyMarkup(Markup.inlineKeyboard([]))
            await ctx.replyWithHTML(i18Msg(ctx, 'sync_confirmed', {
                rows: await db.repoAdmin.countTotalRows()
            }))
        } else {
            await ctx.replyWithHTML(i18Msg(ctx, 'sync_no_transaction'))
        }
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
        const total = stats.find(r => r.category === ctx.session.adminScene.cat)?.count || 0
        const events = await db.repoAdmin.findAllChangedEventsByCat(ctx.session.adminScene.cat, nextWeekEndRange, POSTS_PER_PAGE_ADMIN, ctx.session.paging.pagingOffset)
        return {total, events}
    } else {
        const stats = await db.repoAdmin.findStatsByReviewer(nextWeekEndRange)
        const total = stats.find(r => r.reviewer === ctx.session.adminScene.reviewer)?.count || 0
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

async function switchCard(ctx: ContextMessageUpdate, version: 'current' | 'snapshot') {
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
            await db.repoSnapshot.takeSnapshot(getHumanReadableUsername(getUserFromCtx(ctx)), new Date())
            await ctx.replyWithHTML(i18Msg(ctx, 'snapshot_taken'))
        })
        .command(['level_silly', 'level_debug', 'level_error'], async (ctx) => {
            loggerTransport.level = ctx.message.text.replace(/^\/[^_]+_/, '')
            await ctx.replyWithHTML(i18Msg(ctx, 'log_level_selected', {level: logger.level}))
            if (loggerTransport.level === 'silly') {
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
