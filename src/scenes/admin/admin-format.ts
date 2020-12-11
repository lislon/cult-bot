import { i18nSceneHelper } from '../../util/scene-helper'
import { BaseScene, Extra, Markup } from 'telegraf'
import { allCategories, ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { StatByCat, StatByReviewer } from '../../database/db-admin'
import { CallbackButton } from 'telegraf/typings/markup'
import { getNextWeekEndRange, ruFormat } from '../shared/shared-logic'
import { db } from '../../database/db'
import { subSeconds } from 'date-fns'
import { SpreadSheetValidationError } from '../../dbsync/dbsync'
import { SyncDiff } from '../../database/db-sync-repository'
import { EventToSave } from '../../interfaces/db-interfaces'
import { menuCats, totalValidationErrors } from './admin-common'

const scene = new BaseScene<ContextMessageUpdate>('admin_scene');

const {actionName, i18SharedBtn, i18Btn, i18Msg} = i18nSceneHelper(scene)

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

export const formatMainAdminMenu = async (ctx: ContextMessageUpdate) => {
    const dateRanges = getNextWeekEndRange(ctx.now())

    return await db.task(async (dbTask) => {
        const statsByName: StatByCat[] = await dbTask.repoAdmin.findChangedEventsByCatStats(dateRanges)

        let adminButtons: CallbackButton[][] = []

        const snapshotMeta = await dbTask.repoSnapshot.getSnapshotMeta()
        if (snapshotMeta !== undefined) {

            adminButtons = [...adminButtons, [Markup.callbackButton(i18Btn(ctx, 'menu_changed_snapshot', {
                    date: ruFormat(snapshotMeta.createdAt, 'dd MMMM HH:mm:ss'),
                    user: snapshotMeta.createdBy
                }),
                'fake'
            )]]

            adminButtons = [...adminButtons, ...await menuCats.map(row =>
                row.map(btnName => {
                    const count = statsByName.find(r => r.category === btnName)
                    return Markup.callbackButton(i18Btn(ctx, btnName, {count: count === undefined ? 0 : count.count}), actionName(btnName));
                })
            )]
        }

        adminButtons = [...adminButtons, [Markup.callbackButton(i18Btn(ctx, 'menu_per_names'), 'fake')]]

        const statsByReviewer = await dbTask.repoAdmin.findStatsByReviewer(dateRanges)
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
    })


}

export async function formatMessageForSyncReport(errors: SpreadSheetValidationError[], syncResult: SyncDiff, ctx: ContextMessageUpdate) {
    const formatBody = () => {
        const categoryRows = allCategories
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
                return rows.join('\n') + (rows.length > 0 ? '\n' : '')
            })
        const s = categoryRows.join('\n') + '\n'
        if (categoryRows.length === 0) {
            return ' - ничего нового'
        } else {
            return `\n\n${s}`
        }
    }

    const formatErrors = () => {
        return i18Msg(ctx, 'sync_error_title', {
            totalErrors: totalValidationErrors(errors),
            errors: errors
                .filter(e => e.extIds.length > 0)
                .map(e => i18Msg(ctx, 'sync_error_row', {
                    sheetName: e.sheetName,
                    extIds: e.extIds.join(', ')
                }))
                .join('\n')
        })
    }

    return formatBody() + '\n' + (totalValidationErrors(errors) > 0 ? formatErrors() : '✅ 0 Ошибок')
}