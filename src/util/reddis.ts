import RedisSession from 'telegraf-session-redis'
import { botConfig } from './bot-config'
import { Context } from 'telegraf'
import { TelegrafContext } from 'telegraf/typings/context'
import { RedisClient } from 'redis'
import { promisify } from 'util'

export interface MyRedisSession {
    middleware(): (ctx: any, next?: (() => any) | undefined) => any

    getSession(key: Context): string

    saveSession(key: string, session: object): object

    client: RedisClient

    options: {
        getSessionKey: (ctx: TelegrafContext) => string
    }
}

function getRedis(): MyRedisSession {
    if (botConfig.NODE_ENV === 'test') {
        const redis = require('redis-mock'),
            client = redis.createClient();

        return {
            getSession(key: TelegrafContext): string {
                return '';
            },
            middleware(): (ctx: any, next?: ((() => any) | undefined)) => any {
                return function (p1: any, p2: (() => any) | undefined) {
                };
            },
            saveSession(key: string, session: object): object {
                return undefined;
            },
            get options() {
                return {
                    getSessionKey: (ctx: TelegrafContext) => 'mock'
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
            }
        }) as unknown as MyRedisSession
    }
}

export const redisSession: MyRedisSession = getRedis()
export const redis = {
    get: promisify(redisSession.client.get.bind(redisSession.client)),
    set: promisify(redisSession.client.set.bind(redisSession.client))
}

