import Telegraf, { BaseScene, Extra, Markup } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { backButtonRegister } from '../../util/scene-helper'
import TelegrafI18n from 'telegraf-i18n'
import { InlineKeyboardButton } from 'telegraf/typings/markup'

const scene = new BaseScene<ContextMessageUpdate>('customize_scene');

const {backButton, sceneHelper, actionName, i18nModuleBtnName} = backButtonRegister(scene)


// SELECT DISTINCT cb_events.category, ct."name"
// FROM cb_tags ct
// JOIN cb_events_to_tags ON (cb_events_to_tags.tag_id  = ct.id)
// JOIN cb_events  ON (cb_events.id  = cb_events_to_tags.event_id)
// WHERE ct.category  = 'tag_level_1'
// ORDER  BY category , name
// concerts	#классическийконцерт
// concerts	#сборныйконцерт
// concerts	#сольныйконцерт
// events	#встречасперсоной
// events	#курс
// events	#лекция
// events	#мастеркласс
// events	#онлайн
// events	#подкаст
// exhibitions	#временнаявыставка
// exhibitions	#выставка
// exhibitions	#выставочныйпроект
// exhibitions	#доммузей
// exhibitions	#онлайн
// exhibitions	#постояннаяэкспозиция
// theaters	#аудиоспектакль
// theaters	#драматическийтеатр
// theaters	#мюзикл
// theaters	#онлайн
// theaters	#опера
// theaters	#прогулка
// theaters	#танец
// theaters	#эксперимент
// walks	#аудиоэкскурсия
// walks	#городсгидом
// walks	#знакомствоспространством
// walks	#онлайн
// walks	#экскурсиясгидом



function countFilteredEvents(ctx: ContextMessageUpdate) {
    return 5
}

const content = (ctx: ContextMessageUpdate) => {
    const {i18Btn, i18Msg} = sceneHelper(ctx)

    const keyboard = [
        [
            Markup.button(i18Btn('timetable')),
            Markup.button(i18Btn('oblasti')),
            Markup.button(i18Btn('priorities'))
        ],
        [Markup.button(i18Btn('show_personalized_events', {count: countFilteredEvents(ctx)}))],
        [backButton(ctx)],
    ]

    return {
        msg: i18Msg('welcome'),
        markup: Extra.HTML(true).markup(Markup.keyboard(keyboard).resize())
    }
}

function putCheckbox(isSelected: boolean) {
    return isSelected ? ' ✔' : ''
}

class Menu {
    private readonly selected: string[]
    private readonly uiMenusState: UIMenusState
    private readonly ctx: ContextMessageUpdate
    private readonly section: string

    constructor(ctx: ContextMessageUpdate, selected: string[], uiMenusState: UIMenusState) {
        this.selected = selected
        this.uiMenusState = uiMenusState;
        this.ctx = ctx;
        this.section = 'interests'
    }

    button(tag: string, hide: boolean = false): InlineKeyboardButton {
        const {i18Btn} = sceneHelper(this.ctx)

        const isSelected = this.selected.includes(tag)
        return Markup.callbackButton(i18Btn(`${this.section}.${tag}`) + putCheckbox(isSelected), actionName(`select_${tag}`), hide)
    }

    dropDownButtons(title: string, submenus: string[]): InlineKeyboardButton[][] {
        const {i18Btn} = sceneHelper(this.ctx)

        const isAnySubmenuSelected = submenus.find(tag => this.selected.includes(tag)) !== undefined;

        const isOpen = this.uiMenusState.get(i18Btn(`${this.section}.menu_${title}`))
        return [
            [Markup.callbackButton((isOpen ? '➖ ' : '➕ ') + title + putCheckbox(isAnySubmenuSelected), actionName(`menu_${title}`))],
            [...submenus.map(tag => this.button(tag, !isOpen))]
        ]
    }

}

const chidrensMenus = ['#сдетьми0+', '#сдетьми4+', '#сдетьми12+', '#сдетьми16+']

function getKeyboard(ctx: ContextMessageUpdate, state: CustomizeSceneState) {
    const menu = new Menu(ctx, state.interests, state.uiMenuState)


    const buttons = [
        ...(menu.dropDownButtons('дети', chidrensMenus)),
        [menu.button('#комфорт')],
        [menu.button('#компанией')],
        [menu.button('#ЗОЖ')],
        [menu.button('#комфорт')],
        [menu.button('#новыеформы')],
        [menu.button('#успетьзачас')],
        [menu.button('#навоздухе')],
        [menu.button('#премьера')],
        [menu.button('#культурныйбазис')],
        ...(menu.dropDownButtons('стоимость', ['#доступноподеньгам', '#бесплатно']))
    ]
    return Markup.inlineKeyboard(buttons)
}


function registerActions(bot: Telegraf<ContextMessageUpdate>, i18n: TelegrafI18n) {
    bot
        .hears(i18nModuleBtnName('oblasti'), async (ctx: ContextMessageUpdate) => {
            // please_select_priorities
            await prepareSessionStateIfNeeded(ctx)
            // const strings = await loadAllOblasti()
            // strings.push(i18n.t(`ru`, 'shared.keyboard.back', {}))

            // const keyboard = Markup.keyboard(strings, {
            //      columns: 2
            //  })


            await ctx.replyWithHTML('Oblsati')
        })
        .hears(i18nModuleBtnName('priorities'), async (ctx: ContextMessageUpdate) => {
            const {i18Btn, i18Msg} = sceneHelper(ctx)

            await prepareSessionStateIfNeeded(ctx)
            const inlineKeyboard = getKeyboard(ctx, ctx.session.customize)


            const markupKeyabord = Markup.keyboard([
                [Markup.button(i18Btn('show_personalized_events', {count: countFilteredEvents(ctx)}))],
                [Markup.button(i18Btn('go_back_to_customize'))],
                [Markup.button(i18Btn('go_back_to_main'))]
            ]).resize()


            const msg = await ctx.replyWithHTML(i18Msg('select_priorities'), Extra.markup((inlineKeyboard)))
            const msg2 = await ctx.replyWithHTML(i18Msg('select_priorities_footer'), Extra.markup((markupKeyabord)))
            // const msg = await ctx.replyWithHTML(i18Msg('select_priorities'))

            // await sleep(1000)
            // const markup = Extra.inReplyTo(msg.message_id)
            // await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, 'lisa', Extra.markup((inlineKeyboard)))
        })
        .hears(/события по фильтру/, async (ctx: ContextMessageUpdate) => {
            await ctx.replyWithHTML('скоро будет')
        })
    ;


}

scene
    .enter(async (ctx: ContextMessageUpdate) => {
        prepareSessionStateIfNeeded(ctx)
        console.log('enter customize-scene')

        const {msg, markup} = content(ctx)
        await ctx.replyWithMarkdown(msg, markup)
    })
    .action(actionName('oblasti'), nothing)
    .action(actionName('priorities'), nothing)
    .action(/customize_scene[.]menu_(.+)/, async (ctx: ContextMessageUpdate) => {
        const menuState = ctx.session.customize.uiMenuState
        menuState.set(ctx.match[1], !menuState.get(ctx.match[1]))

        await ctx.editMessageReplyMarkup(getKeyboard(ctx, ctx.session.customize))
    })
    .action(/customize_scene[.]select_(.+)/, async (ctx: ContextMessageUpdate) => {
        const selected = ctx.match[1]

        if (ctx.session.customize.interests.includes(selected)) {
            ctx.session.customize.interests = ctx.session.customize.interests.filter(s => s !== selected)
        } else {
            if (chidrensMenus.includes(selected)) {
                ctx.session.customize.interests = ctx.session.customize.interests.filter(s => !chidrensMenus.includes(s))
            }
            ctx.session.customize.interests.push(selected)
        }
        await ctx.editMessageReplyMarkup(getKeyboard(ctx, ctx.session.customize))
    })
    .hears(i18nModuleBtnName('go_back_to_customize'), async (ctx: ContextMessageUpdate) => {
        console.log('customize-scene-back')
        await ctx.scene.enter('customize_scene')
    });


function prepareSessionStateIfNeeded(ctx: ContextMessageUpdate) {
    if (ctx.session.customize === undefined) {
        ctx.session.customize = {
            uiMenuState: new Map(),
            interests: [],
            time: {
                weekdays: {
                    '6': [],
                    '7': []
                }
            }
        }
    }
}


async function nothing(ctx: ContextMessageUpdate) {

    // switch (ctx.session.customize.nothingNum++) {
    //     case 0:
    //         await ctx.reply('Пока тут ничего нет :(')
    //         break
    //     case 1:
    //         await ctx.reply('И тут тоже :(')
    //         break
    //     default:
    //         await ctx.reply('И тут :(')
    //         break
    // }
}


export {
    scene as customizeScene,
    registerActions as customizeRegisterActions
}

export interface UIMenusState extends Map<string, boolean> {
}

export interface CustomizeSceneState {
    time: CustomizeSceneTimeState
    uiMenuState: UIMenusState
    interests: string[]
}

export interface CustomizeSceneTimeState {
    weekdays: WeekDayTimeSlot
}

export type WeekDayTimeSlot = {
    ['6']?: string[]
    ['7']?: string[]
}

export type Slot = '12:00-13:00' | '13:00-14:00';