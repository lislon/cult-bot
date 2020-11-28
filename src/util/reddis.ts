import RedisSession from 'telegraf-session-redis'
import { botConfig } from './bot-config'
import { Context } from 'telegraf'
import { TelegrafContext } from 'telegraf/typings/context'


interface MyRedisSession {
    middleware(): (ctx: any, next?: (() => any) | undefined) => any

    getSession(key: Context): string

    saveSession(key: string, session: object): object
}

function getRedis(): MyRedisSession {
    if (botConfig.NODE_ENV === 'test') {
        return {
            getSession(key: TelegrafContext): string {
                return '';
            }, middleware(): (ctx: any, next?: ((() => any) | undefined)) => any {
                return function (p1: any, p2: (() => any) | undefined) {
                };
            }, saveSession(key: string, session: object): object {
                return undefined;
            }
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

export const redisSession = getRedis()

