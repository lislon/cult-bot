import RedisSession from 'telegraf-session-redis'
import { botConfig } from './bot-config'
import { Context } from 'telegraf'
import { Callback, OverloadedKeyCommand, RedisClient } from 'redis'
import { promisify } from 'util'
import redisMock from 'redis-mock'

export interface MyRedisSession {
    middleware(): (ctx: any, next?: (() => any) | undefined) => any

    getSession(key: Context): string

    saveSession(key: string, session: any): any

    client: RedisClient

    options: {
        getSessionKey: (ctx: Context) => any
    }
}

function createRedisClient(): MyRedisSession {
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

let redisSession: MyRedisSession = undefined
let mySimpleRedis: MySimpleRedis = undefined

interface MySimpleRedis {
    get: (key: string) => Promise<string>,
    set: (key: string, value: string) => Promise<void>
    end: (flush?: boolean) => void
    rpush: OverloadedKeyCommand<string, number, Promise<number>>
    lrange: (key: string, start: number, stop: number) => Promise<string[]>
    keys: (pattern: string) => Promise<string[]>
    expire: (key: string, seconds: number) => Promise<number>
    del: (key: string) => Promise<number>
    flushdb: () => Promise<void>
    incr: (key: string) => Promise<number>
    sadd: (key: string, value: string) => Promise<number>
    scan: OverloadedKeyCommand<string, [string, string[]], Promise<[string, string[]]>>
}

export function getRedisSession(): MyRedisSession {
    if (redisSession === undefined) {
        redisSession = createRedisClient()
    }
    return redisSession
}

export function getRedis(): MySimpleRedis {
    if (mySimpleRedis === undefined) {
        const r = getRedisSession()
        mySimpleRedis = {
            get: promisify(r.client.get.bind(r.client)),
            set: promisify(r.client.set.bind(r.client)),
            end: promisify(r.client.end.bind(r.client)),
            keys: promisify(r.client.keys.bind(r.client)),
            rpush: promisify(r.client.rpush.bind(r.client)),
            del: promisify(r.client.del.bind(r.client)),
            lrange: promisify(r.client.lrange.bind(r.client)),
            expire: promisify(r.client.expire.bind(r.client)),
            flushdb: promisify(r.client.flushdb.bind(r.client)),
            incr: promisify(r.client.incr.bind(r.client)),
            sadd: promisify(r.client.sadd.bind(r.client)),
            scan: promisify(r.client.scan.bind(r.client)),
        }

    }
    return mySimpleRedis;
}