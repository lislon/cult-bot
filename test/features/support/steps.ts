import { AfterAll, Before, BeforeAll, DataTable, Given, Then, When } from '@cucumber/cucumber'
import { db, dbCfg } from '../../../src/database/db'

import expect from 'expect'
import { mskMoment } from '../../../src/util/moment-msk'
import { AnyTypeOfKeyboard, MarkupHelper } from '../lib/MarkupHelper'
import { BotReply } from '../lib/TelegramMockServer'
import emojiRegex from 'emoji-regex'
import { getMockEvent, syncDatabase4Test } from '../../functional/db/db-test-utils'
import { parseAndPredictTimetable } from '../../../src/lib/timetable/timetable-utils'
import { allCategories, ContextMessageUpdate } from '../../../src/interfaces/app-interfaces'
import { ITestCaseHookParameter } from '@cucumber/cucumber/lib/support_code_library_builder/types'
import { botConfig } from '../../../src/util/bot-config'

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

Given(/^I'am already used bot (\d+) times$/, async function (times: number) {
    await this.useBeforeScenes((ctx: ContextMessageUpdate) => {
        ctx.session.analytics = {
            inlineClicks: 0,
            markupClicks: times
        }
    })
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

        return getMockEvent({...row, eventTime: timetableResult.timeIntervals})
    })

    await syncDatabase4Test(mockEvents)
})


Given(/^Scene is '(.+)'$/, async function (scene: string) {
    drainEvents.call(this)
    await this.enterScene(scene)
})

When(/^I type '(.+)'$/, async function (text: string) {
    drainEvents.call(this)
    await this.sendMessage(text)
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
    expectTextMatches(nextReply, expected)
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

function expectTextMatches(reply: BotReply, expectedText: string) {
    if (expectedText.startsWith('*') && expectedText.endsWith('*')) {
        expect(reply.text).toContain(expectedText.substring(1, expectedText.length - 1))
    } else {
        expect(reply.text).toStrictEqual(expectedText)
    }
}

Then(/^Bot sends reply to chat '(.+)' with message '(.+)'$/, function (chatIdEnvName: 'SUPPORT_FEEDBACK_CHAT_ID', expectedText: string) {
    const botReply = this.getNextMsgOtherChat()
    expectTextMatches(botReply, expectedText)
    expect(botReply.message.chat.id).toEqual(+botConfig[chatIdEnvName])
});

Then(/^I will be on scene '(.+)'$/, function (expectedScene: string) {
    expect(this.ctx()?.scene?.current?.id).toEqual(expectedScene)
});



Before(async () => await syncDatabase4Test([]))
Before(function (testCase: ITestCaseHookParameter) {
    this.initTestCase(testCase)
})
BeforeAll(() => dbCfg.connectionString?.includes('test') || process.exit(666))
AfterAll(db.$pool.end)