import { CreatePaymentResponse } from '@culthub/interfaces'
import debugNamespace from 'debug'
import { appConfig } from '@/src/lib/app-config'
import axios, { AxiosInstance } from 'axios'
import * as AxiosLogger from 'axios-logger'
import { AllExhibitionsResponse } from '@culthub/interfaces/typings/api/web';

const debug = debugNamespace('web:bot-api')

export class BotApi {
    private instance: AxiosInstance | undefined = undefined

    private static async login(): Promise<AxiosInstance> {
        try {
            debug(`login started to ${appConfig.CULTHUB_BOT_API_URL}`)
            const instance = axios.create({
                baseURL: appConfig.CULTHUB_BOT_API_URL,
                timeout: 40 * 1000,
                headers: {
                    'Authorization': `${await BotApi.receiveAuthToken()}`
                }
            })

            instance.interceptors.request.use((request) =>
                AxiosLogger.requestLogger(request, {
                    logger: debug.bind(this)
                }))
            instance.interceptors.response.use((response) =>
                AxiosLogger.responseLogger(response, {
                    logger: debug.bind(this)
                }))
            debug('login success')
            return instance
        } catch (e) {
            throw new Error(e)
        }
    }

    private async getAxios(): Promise<AxiosInstance> {
        if (this.instance === undefined) {
            this.instance = await BotApi.login()
        }
        return this.instance
    }

    public async apiCreatePaymentByToken(token: string): Promise<CreatePaymentResponse> {
        return (await (await this.getAxios()).post(`/payment/create`, {token})).data
    }

    public async apiGetExhibitions(): Promise<AllExhibitionsResponse> {
        return (await (await this.getAxios()).get(`/exhibitions`)).data
    }

    private static async receiveAuthToken(): Promise<string> {
        const formData = (x: Record<string, string>) =>
            Object.keys(x).reduce((p, c) => p + `${p !== '' ? '&' : ''}${c}=${encodeURIComponent(x[c])}`, '')


        debug(`receiveAuthToken: getting token from ${appConfig.OKTA_OAUTH2_ISSUER}`)
        const token = Buffer.from(`${appConfig.OKTA_OAUTH2_CLIENT_ID}:${appConfig.OKTA_OAUTH2_CLIENT_SECRET}`).toString('base64')

        const {token_type, access_token} = (await axios({
            url: `${appConfig.OKTA_OAUTH2_ISSUER}/v1/token`,
            method: 'POST',
            data: formData({
                'grant_type': 'client_credentials',
                'scope': 'read'
            }),
            headers: {
                'Authorization': `Basic ${token}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        })).data
        debug(`receiveAuthToken: token received ${[token_type, access_token].join(' ')}`)
        return [token_type, access_token].join(' ')
    }
}

export const botApi = new BotApi()