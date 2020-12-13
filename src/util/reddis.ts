import RedisSession from 'telegraf-session-redis'
import { botConfig } from './bot-config'
import { Context } from 'telegraf'
import { TelegrafContext } from 'telegraf/typings/context'
import { RedisClient } from 'redis'


interface MyRedisSession {
    middleware(): (ctx: any, next?: (() => any) | undefined) => any

    getSession(key: Context): string

    saveSession(key: string, session: object): object

    client: RedisClient
}

function getRedis() {
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
            client
        }
    } else {
        return new RedisSession({
            store: {
                host: undefined,
                port: undefined,
                url: botConfig.REDIS_URL
            }
        })
    }
}

export const redisSession: MyRedisSession = getRedis()
export const redis = redisSession.client

