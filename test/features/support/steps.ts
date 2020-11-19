import { AfterAll, Before, BeforeAll, DataTable, Given, Then, When } from '@cucumber/cucumber'
import { db, dbCfg } from '../../../src/db'

import expect from 'expect'
import { mskMoment } from '../../../src/util/moment-msk'
import { AnyTypeOfKeyboard, MarkupHelper } from '../lib/MarkupHelper'
import { BotReply } from '../lib/TelegramMockServer'
import emojiRegex from 'emoji-regex'
import { getMockEvent, syncDatabase4Test } from '../../functional/db/db-test-utils'
import { parseAndPredictTimetable } from '../../../src/lib/timetable/timetable-utils'
import { allCategories } from '../../../src/interfaces/app-interfaces'

function expectLayoutsSame(buttonsLayout: string, markup: AnyTypeOfKeyboard) {
    if (buttonsLayout.match(emojiRegex())) {
        expect(MarkupHelper.toLayout(markup)).toEqual(MarkupHelper.trimLeft(buttonsLayout))
    } else {
        expect(MarkupHelper.toLayout(markup)
            .replace(emojiRegex(), '')
            .replace(/\[\s+/g, '[')
            .replace(/\s]+/g, ']')
        ).toEqual(MarkupHelper.trimLeft(buttonsLayout))
    }
}

function drainEvents() {
    while (this.getNextMsg() !== undefined) {
    }
}

Given(/^now is (\d+-\d+-\d+ \d+:\d+)$/, async function (dateStr: string) {
    await this.setNow(mskMoment(dateStr))
})

Given(/^there is events:$/, async function (table: DataTable) {

    const mockEvents = table.hashes().map((row: any) => {
        if (row.timetable === undefined) {
            row.timetable = 'сб-вс: 18:00'
        }
        if (row.tag_level_1 !== undefined) {
            row.tag_level_1 = row.tag_level_1.split(/\s*,\s*/)
        }
        if (row.category !== undefined && !allCategories.includes(row.category)) {
            expect(row.category).toEqual(`to be one of ${allCategories.join(',')}`)
        }

        const timetableResult = parseAndPredictTimetable(row.timetable, this.now)

        if (timetableResult.errors.length > 0) {
            expect(row.timetable).toEqual(timetableResult.errors.join('\n'))
        }

        return getMockEvent({ ...row, eventTime: timetableResult.timeIntervals })
    })

    await syncDatabase4Test(mockEvents)
})


When(/^I enter '(.+)'$/, async function (scene: string) {
    drainEvents.call(this)
    await this.enterScene(scene)
})

When(/^I click markup \[(.+)]$/, async function (buttonText: string) {
    drainEvents.call(this)
    await this.clickMarkup(buttonText)
})

When(/^I click inline \[(.+)]$/, async function (buttonText: string) {
    drainEvents.call(this)
    await this.clickInline(buttonText)
})

Then(/^Bot responds '(.+)'$/, function (expected: string) {
    const nextReply = this.getNextMsg() as BotReply
    expect(nextReply.text).toEqual(expected)
})

function expectReplyText(nextReply: BotReply, expected: string) {
    if (nextReply === undefined) {
        expect('').toEqual('No new messages from bot, but expected')
    }
    expect(nextReply.text).toEqual(expected)
}

Then(/^Bot responds:$/, function (expected: string) {
    const nextReply = this.getNextMsg() as BotReply
    expectReplyText(nextReply, expected)
})

Then(/^Bot responds '(.+)' with markup buttons:$/, function (expected: string, buttonsLayout: string) {
    const nextReply = this.getNextMsg() as BotReply
    expectReplyText(nextReply, expected)
    expect(MarkupHelper.getKeyboardType(nextReply)).toEqual('markup')
    expectLayoutsSame(buttonsLayout, nextReply.extra.reply_markup)
})

Then(/^Bot responds '(.+)' with inline buttons:$/, function (expected: string, buttonsLayout: string) {
    const nextReply = this.getNextMsg() as BotReply
    expectReplyText(nextReply, expected)
    expect(MarkupHelper.getKeyboardType(nextReply)).toEqual('inline')

    expectLayoutsSame(buttonsLayout, nextReply.extra.reply_markup)
})

Then(/^Bot edits inline buttons:$/, function (buttonsLayout: string) {
    const markup = this.getLastEditedInline() as BotReply
    if (markup === undefined) {
        fail('Expected edited markup but none')
    }
    expectLayoutsSame(buttonsLayout, markup.message.reply_markup)
})

Then(/^Bot responds with event '(.+)'/, function (eventTitle: string) {
    const nextReply = this.getNextMsg() as BotReply
    if (nextReply === undefined) {
        expect('').toEqual('No new messages from bot, but expected')
    }
    expect(nextReply.text).toContain(`<b>${eventTitle}</b>\n`)
})

Then(/^Bot responds something$/, function () {
    const msg = this.getNextMsg()
});

Before(async () => await syncDatabase4Test([]))
BeforeAll(() => dbCfg.connectionString?.includes('test') || process.exit(666))
AfterAll(db.$pool.end)