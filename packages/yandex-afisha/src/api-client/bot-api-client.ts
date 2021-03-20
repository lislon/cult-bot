import btoa from 'btoa'
import { appConfig } from '../app-config'
import got from 'got'
import { FindMatchingEventRequest, FindMatchingEventResponse } from '@culthub/interfaces'
import debugNamespace from 'debug'

const debug = debugNamespace('api')

export async function apiFindMatching(req: FindMatchingEventRequest): Promise<FindMatchingEventResponse> {
    debug(`Sending request with ${req.events.length} events...`)
    const json: FindMatchingEventResponse = await got.post(`${appConfig.CULTHUB_BOT_API_URL}/find-matching`, {
        json: req,
        headers: {
            authorization: await receiveAuthToken()
        },
        timeout: {
            connect: 40
        }
    }).json()

    return json
}

async function receiveAuthToken(): Promise<string> {
    const token = btoa(`${appConfig.OKTA_OAUTH2_CLIENT_ID}:${appConfig.OKTA_OAUTH2_CLIENT_SECRET}`)
    const {token_type, access_token} = await got(`${appConfig.OKTA_OAUTH2_ISSUER}/v1/token`, {
        method: 'POST',
        headers: {
            authorization: `Basic ${token}`,
        },
        form: {
            grant_type: 'client_credentials',
            scope: 'read',
        },
    }).json()
    return [token_type, access_token].join(' ')
}