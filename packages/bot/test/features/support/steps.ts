import { AfterAll, Before, BeforeAll, DataTable, Given, Then, When } from '@cucumber/cucumber'
import { db, dbCfg } from '../../../src/database/db'

import expect from 'expect'
import { mskMoment } from '../../../src/util/moment-msk'
import { AnyTypeOfKeyboard, MarkupHelper } from '../lib/MarkupHelper'
import { BotReply } from '../lib/TelegramMockServer'
import emojiRegex from 'emoji-regex'
import { getMockEvent, MockPackForSave, syncEventsDb4Test, syncPacksDb4Test } from '../../functional/db/db-test-utils'
import { parseAndPredictTimetable } from '../../../src/lib/timetable/timetable-utils'
import { allCategories, ContextMessageUpdate } from '../../../src/interfaces/app-interfaces'
import { ITestCaseHookParameter } from '@cucumber/cucumber/lib/support_code_library_builder/types'
import { botConfig } from '../../../src/util/bot-config'
import { clone } from 'lodash'
import { InlineKeyboardMarkup } from 'telegraf/typings/telegram-types'
import { first } from 'lodash/fp'

function clean(str: string) {
    return str
        .replace(emojiRegex(), '')
        .replace(/[🏛]/g, '')
        .replace(/\[\s+/g, '[')
        .replace(/\s]+/g, ']')
        .replace(/(?<=<[^/>]+>)\s+/g, '')
}

function assertEqualsWithEmojyRespect(expected: string, actual: string) {
    if (expected.match(emojiRegex())) {
        expect(actual).toEqual(expected)
    } else {
        const a = clean(actual)
        const e = clean(expected)
        expect(a).toEqual(e)
    }
}

function expectLayoutsSame(expectedLayout: string, actualLayout: AnyTypeOfKeyboard) {
    const actual = MarkupHelper.toLayout(actualLayout)
    const expected = MarkupHelper.prepareExpectedLayout(expectedLayout)

    assertEqualsWithEmojyRespect(expected, actual)
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
            row.tag_level_1 = row.tag_level_1.split(/[\s,]+/)
        }
        if (row.category !== undefined && !allCategories.includes(row.category)) {
            expect(row.category).toEqual(`to be one of ${allCategories.join(',')}`)
        }

        const timetableResult = parseAndPredictTimetable(row.timetable, this.now, botConfig)

        if (timetableResult.errors.length > 0) {
            expect(row.timetable).toEqual(timetableResult.errors.join('\n'))
        }

        return getMockEvent({...row, eventTime: timetableResult.timeIntervals})
    })

    await syncEventsDb4Test(mockEvents)
})

Given(/^there is packs:$/, async function (table: DataTable) {

    const mockPacks = table.hashes().map((row: any) => {
        return {
            extId: row.title,
            title: row.title,
            author: row.author || 'Test',
            description: row.desc || 'pack desc',
            eventTitles: row.events.split(/[\s,]+/),
            weight: row.weight || 0
        } as MockPackForSave
    })

    await syncPacksDb4Test(mockPacks)
})

Given(/^Scene is '(.+)'$/, async function (scene: string) {
    drainEvents.call(this)
    await this.enterScene(scene)
})

Given(/^I blocked the bot$/, async function () {
    drainEvents.call(this)
    await this.blockBotByUser()
})

Given(/^bot config ([A-Z_]+)=(.+)$/, async function (key: string, strValue: string) {
    if (isNaN(+strValue)) {
        (botConfig as any)[key] = strValue
    } else {
        (botConfig as any)[key] = +strValue
    }
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

When(/^I start bot with payload '(.+)'$/, async function (payload: string) {
    drainEvents.call(this)
    await this.start(payload)
})

When(/^I click slider next$/, async function () {
    drainEvents.call(this)

    const {buttons} = this.server.getListOfInlineButtonsFromLastMsg()
    const btn = buttons.find((btn: any) => btn.text.includes('»'))
    await this.clickInline(btn?.text ?? '»')
})

Then(/^Bot responds nothing$/, function (expected: string) {
    const nextReply = this.getNextMsg() as BotReply
    expect(nextReply).toBeUndefined()
})


Then(/^Bot responds '(.+)'$/, function (expected: string) {
    const nextReply = this.getNextMsg() as BotReply
    expectTextMatches(nextReply, expected)
})

Then(/^Bot responds:$/, function (expected: string) {
    const nextReply = this.getNextMsg() as BotReply
    expectTextMatches(nextReply, expected)
})

Then(/^Bot responds '(.+)' with no markup buttons$/, function (expected: string) {
    const nextReply = this.getNextMsg() as BotReply
    expectTextMatches(nextReply, expected)
    expect(nextReply.extra.reply_markup).toStrictEqual({ remove_keyboard: true })
})

Then(/^Bot responds with cb '(.+)'$/, function (expected: string) {
    if (expected.startsWith('*') && expected.endsWith('*')) {
        expect(this.getLastCbQuery()).toContain(expected.substring(1, expected.length - 1))
    } else {
        expect(this.getLastCbQuery()).toStrictEqual(expected)
    }
})

Then(/^Bot responds '(.+)' with markup buttons:$/, function (expected: string, buttonsLayout: string) {
    const nextReply = this.getNextMsg() as BotReply
    expectTextMatches(nextReply, expected)
    expect(MarkupHelper.getKeyboardType(nextReply)).toEqual('markup')
    expectLayoutsSame(buttonsLayout, nextReply.extra.reply_markup)
})

Then(/^Bot responds '(.+)' with inline buttons:$/, function (expected: string, buttonsLayout: string) {
    const nextReply = this.getNextMsg() as BotReply
    expectTextMatches(nextReply, expected)
    expect(MarkupHelper.getKeyboardType(nextReply)).toEqual('inline')

    expectLayoutsSame(buttonsLayout, nextReply.extra.reply_markup)
})

Then(/^Bot edits text '(.+)'$/, function (expected: string) {
    const editedReply = this.getLastEditedInline() as BotReply
    expectTextMatches(editedReply, expected)
})

Then(/^Bot edits text:$/, function (expected: string) {
    const editedReply = this.getLastEditedInline() as BotReply
    expectTextMatches(editedReply, expected)
})

Then(/^Bot edits inline buttons:$/, function (buttonsLayout: string) {
    const markup = this.getLastEditedInline() as BotReply
    if (markup === undefined) {
        expect('').toStrictEqual('Expected edited markup but none')
    }
    expectLayoutsSame(buttonsLayout, markup.extra.reply_markup)
})

Then(/^Bot edits slider with event '(.+)'$/, function (eventTitle: string) {
    const markup = this.getLastEditedInline() as BotReply
    expect(markup.text).toContain(`<b>${eventTitle}</b>\n`)
})

Then(/^Bot edits slider with event '(.+)' \[(\d+)\/(\d+)\]$/, function (eventTitle: string, page: number, total: number) {
    const markup = this.getLastEditedInline() as BotReply
    if (markup === undefined) {
        expect('').toEqual('Expected bot will edit slider but nothing happened')
    }

    expect(markup.text).toContain(`<b>${eventTitle}</b>\n`)
    expect((markup.extra.reply_markup as InlineKeyboardMarkup).inline_keyboard[1][1].text).toContain(`${page} / ${total}`)
})

Then(/^Bot responds with slider with event '(.+)'$/, function (eventTitle: string) {
    const markup = this.getNextMsg() as BotReply
    expect(markup.text).toContain(`<b>${eventTitle}</b>\n`)
    expect(markup.extra.reply_markup).toBeTruthy()
})

Then(/^Bot responds with event '(.+)'/, function (eventTitle: string) {
    const nextReply = this.getNextMsg() as BotReply
    if (nextReply === undefined) {
        expect('').toEqual('No new messages from bot, but expected')
    }
    expect(nextReply.text).toContain(`<b>${eventTitle}</b>\n`)
})

Then(/^Bot responds something$/, function () {
    this.getNextMsg()
});

function expectTextMatches(reply: BotReply, expectedText: string) {
    if (reply === undefined) {
        expect('').toEqual('No new messages from bot, but expected')
    }

    if (expectedText.startsWith('*') && expectedText.endsWith('*')) {
        expect(reply.text).toContain(expectedText.substring(1, expectedText.length - 1))
    } else {
        assertEqualsWithEmojyRespect(expectedText, reply.text)
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

Then(/^Google analytics pageviews will be:$/, function (table: DataTable) {
    const expected = table.hashes()
    const actual = this.analyticsRecorder.getPageViews()
        .map(({ dp, dt }: { dp: string, dt: string}) => { return { dp, dt } })
    expect(actual).toEqual(expected)
});

Then(/^Google analytics params will be:$/, function (table: DataTable) {
    const lastMsg = first(this.analyticsRecorder.getPageViews()) as any

    table.hashes().forEach(({ key, value }) => {
        expect(lastMsg[key]).toEqual(value)
    })
})

const ORIGINAL_BOT_CONFIG: typeof botConfig = clone(botConfig)

Before(async () => {
    await db.none(`TRUNCATE cb_events CASCADE`)
    botConfig.setFromKeyValue(ORIGINAL_BOT_CONFIG)
})
Before(function (testCase: ITestCaseHookParameter) {
    this.initTestCase(testCase)
})
BeforeAll(() => dbCfg.connectionString?.includes('test') || process.exit(666))
AfterAll(db.$pool.end)