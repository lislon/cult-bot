import { i18nSceneHelper, i18SharedMsg } from '../../util/scene-helper'
import { Markup, Scenes } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { StatByCat, StatByReviewer } from '../../database/db-admin'
import { getNextWeekendRange, ruFormat } from '../shared/shared-logic'
import { db } from '../../database/db'
import { subSeconds } from 'date-fns'
import { EventsSyncDiff, EventToRecover } from '../../database/db-sync-repository'
import { EventToSave } from '../../interfaces/db-interfaces'
import { countEventValidationErrors, menuCats } from './admin-common'
import { SpreadSheetValidationError } from '../../dbsync/parserSpresdsheetEvents'
import { EventPackValidated } from '../../dbsync/packsSyncLogic'
import { InlineKeyboardButton } from 'telegraf/typings/telegram-types'
import { PackRecovered, PacksSyncDiff, PackToSave } from '../../database/db-packs'
import emojiRegex from 'emoji-regex'
import * as tt from 'telegraf/src/telegram-types'
import { ALL_CATEGORIES } from '@culthub/interfaces'

const scene = new Scenes.BaseScene<ContextMessageUpdate>('admin_scene')

const {actionName, i18Btn, i18Msg} = i18nSceneHelper(scene)

function addReviewersMenu(statsByReviewer: StatByReviewer[], ctx: ContextMessageUpdate) {
    const btn = []
    let thisRow: InlineKeyboardButton.CallbackButton[] = []
    statsByReviewer.forEach(({reviewer, count}) => {
        const icon = i18Msg(ctx, `admin_icons.${reviewer}`, undefined, '') || i18Msg(ctx, 'admin_icons.default')
        thisRow.push(Markup.button.callback(i18Btn(ctx, 'byReviewer', {
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

export async function formatMainAdminMenu(ctx: ContextMessageUpdate): Promise<{ msg: string; markup: tt.ExtraReplyMessage }> {
    const dateRanges = getNextWeekendRange(ctx.now())

    return await db.task(async (dbTask) => {
        const statsByName: StatByCat[] = await dbTask.repoAdmin.findChangedEventsByCatStats(dateRanges)

        let adminButtons: InlineKeyboardButton.CallbackButton[][] = []

        const snapshotMeta = await dbTask.repoSnapshot.getSnapshotMeta()
        if (snapshotMeta !== undefined) {

            adminButtons = [...adminButtons, [Markup.button.callback(i18Btn(ctx, 'menu_changed_snapshot', {
                    date: ruFormat(snapshotMeta.createdAt, 'dd MMMM HH:mm:ss'),
                    user: snapshotMeta.createdBy
                }),
                'fake'
            )]]

            adminButtons = [...adminButtons, ...await menuCats.map(row =>
                row.map(btnName => {
                    const count = statsByName.find(r => r.category === btnName)
                    return Markup.button.callback(i18Btn(ctx, btnName, {count: count === undefined ? 0 : count.count}), actionName(btnName))
                })
            )]
        }

        adminButtons = [...adminButtons, [Markup.button.callback(i18Btn(ctx, 'menu_per_names'), 'fake')]]

        const statsByReviewer = await dbTask.repoAdmin.findStatsByReviewer(dateRanges)
        adminButtons = [...adminButtons, ...addReviewersMenu(statsByReviewer, ctx)]

        adminButtons = [...adminButtons, [Markup.button.callback(i18Btn(ctx, 'menu_actions'), 'fake')]]

        adminButtons.push([
            Markup.button.callback(i18Btn(ctx, 'sync'), actionName('sync')),
        ])
        adminButtons.push([
            Markup.button.callback(i18Btn(ctx, 'version'), actionName('version'))
        ])

        return {
            msg: i18Msg(ctx, 'welcome', {
                start: ruFormat(dateRanges.start, 'dd MMMM HH:mm'),
                end: ruFormat(subSeconds(dateRanges.end, 1), 'dd MMMM HH:mm')
            }),
            markup: Markup.inlineKeyboard(adminButtons)
        }
    })
}

function formatEventsSyncStatus(ctx: ContextMessageUpdate, eventsDiff: EventsSyncDiff): string[] {
    const categoryRows = ALL_CATEGORIES
        .map(cat => {
            const inserted = eventsDiff.inserted.filter(e => e.primaryData.category === cat)
            const recovered = eventsDiff.recovered.filter(e => e.primaryData.category === cat)
            const updated = eventsDiff.updated.filter(e => e.primaryData.category === cat)
            const deleted = eventsDiff.deleted.filter(e => e.old.category === cat)
            return {cat, inserted, recovered, updated, deleted}
        })
        .filter(({inserted, recovered, updated, deleted}) => {
            return inserted.length + recovered.length + updated.length + deleted.length > 0
        })
        .map(({cat, inserted, updated, recovered, deleted}) => {
            let rows: string[] = [
                i18Msg(ctx, `sync_stats_event_cat_header`, {
                    icon: i18SharedMsg('category_icons.' + cat),
                    categoryTitle: i18Msg(ctx, 'sync_stats_event_category_titles.' + cat)
                })
            ]

            if (inserted.length > 0) {
                rows = [...rows, ...inserted.map((i: EventToSave) => i18Msg(ctx, 'sync_stats_event_cat_item_inserted', {
                    ext_id: i.primaryData.extId,
                    title: i.primaryData.title
                }))]
            }
            if (recovered.length > 0) {
                rows = [...rows,
                    ...recovered
                        .filter((i: EventToRecover) => i.old.title === i.primaryData.title)
                        .map((i: EventToRecover) => i18Msg(ctx, 'sync_stats_event_cat_item_recovered', {
                            ext_id: i.primaryData.extId,
                            title: i.primaryData.title
                        })),
                    ...recovered
                        .filter((i: EventToRecover) => i.old.title !== i.primaryData.title)
                        .map((i: EventToRecover) => i18Msg(ctx, 'sync_stats_event_cat_item_recovered_warn', {
                            ext_id: i.primaryData.extId,
                            title: i.primaryData.title,
                            oldTitle: i.old.title
                        }))
                ]
            }
            if (updated.length > 0) {
                rows = [...rows, ...updated.map((i: EventToSave) => i18Msg(ctx, 'sync_stats_event_cat_item_updated', {
                    ext_id: i.primaryData.extId,
                    title: i.primaryData.title
                }))]
            }
            if (deleted.length > 0) {
                rows = [...rows, ...deleted.map(i => i18Msg(ctx, 'sync_stats_event_cat_item_deleted', {
                    ext_id: i.primaryData.extId,
                    title: i.old.title
                }))]
            }
            return rows.join('\n') + (rows.length > 0 ? '\n' : '')
        })
    return categoryRows;
}


function formatPacksSyncStatus(ctx: ContextMessageUpdate, packsDiff: PacksSyncDiff): string[] {
    const { inserted, recovered, updated, deleted } = packsDiff

    let rows: string[] = []

    if (inserted.length > 0) {
        rows = [...rows, ...inserted.map((i: PackToSave) => i18Msg(ctx, 'sync_stats_pack_inserted', {
            ext_id: i.primaryData.extId,
            count: i.primaryData.eventIds.length,
            title: i.primaryData.title.replace(emojiRegex(), '').trim()
        }))]
    }
    if (recovered.length > 0) {
        rows = [...rows,
            ...recovered
                .filter((i: PackRecovered) => i.old.title === i.primaryData.title)
                .map((i: PackRecovered) => i18Msg(ctx, 'sync_stats_pack_recovered', {
                    ext_id: i.primaryData.extId,
                    count: i.primaryData.eventIds.length,
                    title: i.primaryData.title.replace(emojiRegex(), '').trim()
                })),
            ...recovered
                .filter((i: PackRecovered) => i.old.title !== i.primaryData.title)
                .map((i: PackRecovered) => i18Msg(ctx, 'sync_stats_pack_recovered_warn', {
                    ext_id: i.primaryData.extId,
                    title: i.primaryData.title.replace(emojiRegex(), '').trim(),
                    count: i.primaryData.eventIds.length,
                    oldTitle: i.old.title.replace(emojiRegex(), '').trim()
                }))
        ]
    }
    if (updated.length > 0) {
        rows = [...rows, ...updated.map((i: PackToSave) => i18Msg(ctx, 'sync_stats_pack_updated', {
            ext_id: i.primaryData.extId,
            count: i.primaryData.eventIds.length,
            title: i.primaryData.title.replace(emojiRegex(), '').trim()
        }))]
    }
    if (deleted.length > 0) {
        rows = [...rows, ...deleted.map(i => i18Msg(ctx, 'sync_stats_pack_deleted', {
            ext_id: i.primaryData.extId,
            title: i.old.title.replace(emojiRegex(), '').trim()
        }))]
    }

    return rows.length > 0 ? [i18Msg(ctx, 'sync_stats_pack_header'), ...rows] : [];
}

function formatPackErrors(ctx: ContextMessageUpdate, packErrors: EventPackValidated[]) : string {
    return packErrors.map(p => i18Msg(ctx, 'sync_packs_error', {
        title: p.pack.title?.replace(emojiRegex(), '').trim() || p.pack.extId || `Подборка без имени`,
        errors: Object.values([
            ...Object.values(p.errors).filter(e => typeof e === 'string'),
            ...p.errors.badEvents.map(e => e.error)])
            .map(e => ` - ${e}\n`)
            .join('')
    })).join('\n')
}


export async function formatMessageForSyncReport(eventsErrors: SpreadSheetValidationError[],
                                                 packsErrors: EventPackValidated[],
                                                 eventsDiff: EventsSyncDiff,
                                                 packsDiff: PacksSyncDiff,
                                                 ctx: ContextMessageUpdate): Promise<string> {
    const formatEventErrors = (errors: SpreadSheetValidationError[]) => {
        return errors
                .filter(e => e.extIds.length > 0)
                .map(e => i18Msg(ctx, 'sync_error_row', {
                    sheetName: e.sheetTitle,
                    extIds: e.extIds.join(', ')
                }))
                .join('\n')
    }

    const eventsRows = formatEventsSyncStatus(ctx, eventsDiff)
    const packRows = formatPacksSyncStatus(ctx, packsDiff);


    const countEventErrors = countEventValidationErrors(eventsErrors)

    const updated = [...eventsRows, ...packRows]
    const listStr = updated.length > 0 ? updated.join('\n').trim() : 'Ничего нового'

    if (countEventErrors > 0 || packsErrors.length > 0) {
        const errorsRows = [i18Msg(ctx, 'sync_error_title', { count: countEventErrors + packsErrors.length}), '']
        if (countEventErrors > 0) {
            errorsRows.push(formatEventErrors(eventsErrors))
            errorsRows.push('')
        }
        if (packsErrors.length > 0) {
            errorsRows.push(formatPackErrors(ctx, packsErrors))
        }

        return `${listStr}\n\n${errorsRows.join('\n')}`
    } else {
        return `${listStr}\n\n✅ 0 Ошибок`
    }
}