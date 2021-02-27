import rp from 'request-promise'
import { botConfig } from '../../util/bot-config'


export async function apiYandexAfishaRequest(): Promise<void> {
    await rp(`${botConfig.YANDEX_AFISHA_URL}/api/parse`)
}