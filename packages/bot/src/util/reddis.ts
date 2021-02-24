import RedisSession from 'telegraf-session-redis'
import { botConfig } from './bot-config'
import { Context } from 'telegraf'
import { RedisClient } from 'redis'
import { promisify } from 'util'
import redisMock from 'redis-mock'

export interface MyRedisSession {
    middleware(): (ctx: any, next?: (() => any) | undefined) => any

    getSession(key: Context): string

    saveSession(key: string, session: any): any

    client: RedisClient

    options: {
        getSessionKey: (ctx: Context) => string
    }
}

function getRedis(): MyRedisSession {
    if (botConfig.NODE_ENV === 'test') {
        const client = redisMock.createClient()

        return {
            getSession(key: Context): string {
                return ''
            },
            middleware(): (ctx: any, next?: ((() => any) | undefined)) => any {
                return function (p1: any, p2: (() => any) | undefined) {
                    // do nothing
                }
            },
            saveSession(key: string, session: any): any {
                return undefined
            },
            get options() {
                return {
                    getSessionKey: (ctx: Context) => 'mock'
                }
            },
            client
        }
    } else {
        return new RedisSession({
            store: {
                host: undefined,
                port: undefined,
                url: botConfig.REDIS_URL
            },
            ttl: botConfig.REDIS_TTL
        }) as undefined as MyRedisSession
    }
}

export const redisSession: MyRedisSession = getRedis()
export const redis = {
    get: promisify(redisSession.client.get.bind(redisSession.client)),
    set: promisify(redisSession.client.set.bind(redisSession.client))
}

