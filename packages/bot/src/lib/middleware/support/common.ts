import { i18n } from '../../../util/i18n'

export function i18MsgSupport(id: string, templateData?: any): string {
    return i18n.t(`ru`, `scenes.support_chat_scene.${id}`, templateData)
}