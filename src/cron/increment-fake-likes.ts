import { db, IExtensions, pgp } from '../database/db'
import { logger } from '../util/logger'
import { ITask } from 'pg-promise'
import { getNextWeekRange } from '../scenes/shared/shared-logic'
import { LikableEvent } from '../database/db-likes'
import { authToExcel } from '../dbsync/googlesheets'
import { botConfig } from '../util/bot-config'
import { parseRawSheetsEventSpreedsheet } from '../dbsync/parserSpresdsheetEvents'
import { forEach, groupBy } from 'lodash'
import { ExcelUpdater } from '../dbsync/ExcelUpdater'
import { EXCEL_COLUMNS_EVENTS } from '../dbsync/parseSheetRow'
import { AdminEvent } from '../database/db-admin'

type LikeDislikes = { likes: number, dislikes: number }

export function fakeFunction(event: Pick<AdminEvent, 'rating' | 'popularity'>, existing: LikeDislikes): LikeDislikes {
    return {
        likes: event.rating * (event.popularity ?? 1),
        dislikes: 20 - event.rating
    }

    // Лайки = популярность * рейтинг
    // Дизлайки: 20 - рейтинг
}

async function incrementFakeLikes() {
    const now = new Date()
    try {
        await db.tx(async (dbTx: ITask<IExtensions> & IExtensions) => {
            const likableEvents: LikableEvent[] = await dbTx.repoLikes.getAllLikableEvents({
                interval: getNextWeekRange(new Date())
            })

            const excel = await authToExcel()
            const sheetsParsedRows = await parseRawSheetsEventSpreedsheet(excel, botConfig.GOOGLE_DOCS_ID)

            const dbIndexed = groupBy(likableEvents, (x) => x.ext_id)

            const excelUpdater = new ExcelUpdater(excel, EXCEL_COLUMNS_EVENTS)

            sheetsParsedRows.forEach(({rows, sheetId, totalNumberOfRows}) => {
                const excelIndexed = groupBy(rows, (x) => x.data.ext_id)

                const updateLikes = new Map<string, LikeDislikes>()
                excelUpdater.clearColumnFormat(sheetId, 'fake_likes', 1, totalNumberOfRows)
                excelUpdater.clearColumnFormat(sheetId, 'fake_dislikes', 1, totalNumberOfRows)

                forEach(dbIndexed, (rows, extId) => {
                    const dbRow = rows[0]
                    if (excelIndexed[extId] !== undefined) {
                        const excelRow = excelIndexed[extId][0]
                        if ((excelRow.fakeLikes === dbRow.fakeLikes && excelRow.fakeDislikes === dbRow.fakeDislikes) || excelRow.fakeLikes === undefined || excelRow.fakeDislikes === undefined) {
                            const newLikeDislikes = fakeFunction({
                                popularity: excelRow.popularity,
                                rating: excelRow.data.rating
                            }, {
                                likes: excelRow.fakeLikes || 0,
                                dislikes: excelRow.fakeDislikes || 0,
                            })
                            // if (newLikeDislikes.likes !== excelRow.fakeLikes || newLikeDislikes.dislikes !== excelRow.fakeDislikes) {
                            //     updateLikes.set(extId, newLikeDislikes)
                            // }
                            updateLikes.set(extId, newLikeDislikes)
                        }
                    }
                })

                updateLikes.forEach((value, extId) => {
                    const rowNumber = excelIndexed[extId][0].rowNumber
                    excelUpdater.editCellValue(sheetId, 'fake_likes', rowNumber, `${value.likes}`)
                    excelUpdater.editCellValue(sheetId, 'fake_dislikes', rowNumber, `${value.dislikes}`)
                    excelUpdater.colorCell(sheetId, 'fake_likes', rowNumber, 'green')
                    excelUpdater.colorCell(sheetId, 'fake_dislikes', rowNumber, 'green')
                })
            })

            await excelUpdater.update(botConfig.GOOGLE_DOCS_ID)
        })
    } catch (e) {
        logger.error(e)
    }
}

(async function run() {
    logger.debug(`Fake likes: start liking...`)
    await incrementFakeLikes()
    pgp.end()
})()

