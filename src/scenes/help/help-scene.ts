import { BaseScene, Telegraf } from 'telegraf'
import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { i18nSceneHelper } from '../../util/scene-helper'
import { SceneRegister } from '../../middleware-utils'
import { InputFile } from 'telegraf/typings/telegram-types'
import { createReadStream } from 'fs'
import path from 'path'

const scene = new BaseScene<ContextMessageUpdate>('help_scene');
const {i18Msg} = i18nSceneHelper(scene)

let cached_help_file_id = ''

function globalActionsFn(bot: Telegraf<ContextMessageUpdate>) {
    bot
        .help(async (ctx) => {
            ctx.ua.pv({dp: '/help', dt: 'Помощь'})

            let file: InputFile
            if (cached_help_file_id === '') {
                file = {source: createReadStream(path.resolve(__dirname, './assets/help.png'))}
            } else {
                file = cached_help_file_id
            }
            try {
                const result = await ctx.replyWithPhoto(file, {
                    caption: i18Msg(ctx, 'help')
                })
                if (result.photo.length > 0) {
                    cached_help_file_id = result.photo[0].file_id
                }
            } catch (e) {
                cached_help_file_id = ''
                throw e
            }
        })
}

export const helpScene = {
    scene,
    globalActionsFn
} as SceneRegister