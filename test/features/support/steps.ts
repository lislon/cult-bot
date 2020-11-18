import { AfterAll, BeforeAll, Given, Then, When } from '@cucumber/cucumber'
import { db, dbCfg } from '../../../src/db'

import expect from 'expect'
import { mskMoment } from '../../../src/util/moment-msk'
import { MarkupHelper } from '../lib/MarkupHelper'
import { BotReply } from '../lib/TelegramMockServer'

Given(/^now is (\d+-\d+-\d+ \d+:\d+)$/, async function (dateStr: string) {
    await this.setNow(mskMoment(dateStr))
})

function drainEvents() {
    while (this.getNextMsg() !== undefined) {
    }
}

When(/^I enter '(.+)' scene$/, async function (scene: string) {
    drainEvents.call(this)
    await this.enterScene(scene)
});

When(/^I click markup \[(.+)\]$/, async function (buttonText: string) {
    drainEvents.call(this)
    await this.clickMarkup(buttonText)
});

When(/^I click inline \[(.+)\]$/, async function (buttonText: string) {
    drainEvents.call(this)
    await this.clickInline(buttonText)
});

Then(/^Bot responds '(.+)'$/, function (expected: string) {
    const nextReply = this.getNextMsg() as BotReply
    expect(nextReply.text).toEqual(expected)
});

Then(/^Bot responds:$/, function (expected: string) {
    const nextReply = this.getNextMsg() as BotReply
    if (nextReply === undefined) {
        expect('').toEqual('No new messages from bot, but expected')
    }
    expect(nextReply.text).toEqual(expected)
});

Then(/^Bot responds '(.+)' with markup buttons:$/, function (expected: string, buttonsLayout: string) {
    const nextReply = this.getNextMsg() as BotReply
    expect(nextReply.text).toEqual(expected)
    expect(MarkupHelper.getKeyboardType(nextReply)).toEqual('markup')
    expect(MarkupHelper.toLayout(nextReply.extra.reply_markup)).toEqual(buttonsLayout)
});

Then(/^Bot responds '(.+)' with inline buttons:$/, function (expected: string, buttonsLayout: string) {
    const nextReply = this.getNextMsg() as BotReply
    expect(nextReply.text).toEqual(expected)
    expect(MarkupHelper.getKeyboardType(nextReply)).toEqual('inline')
    expect(MarkupHelper.toLayout(nextReply.extra.reply_markup)).toEqual(buttonsLayout)
});

Then(/^Bot edits inline buttons:$/, function (buttonsLayout: string) {
    const markup = this.getLastEditedInline() as BotReply
    if (markup === undefined) {
        fail('Expected edited markup but none')
    }
    expect(MarkupHelper.toLayout(markup.message.reply_markup)).toEqual(buttonsLayout)
});



Then(/^Bot responds something$/, function () {
    const msg = this.getNextMsg()
});

BeforeAll(() => dbCfg.connectionString?.includes('test') || process.exit(666))
AfterAll(db.$pool.end)