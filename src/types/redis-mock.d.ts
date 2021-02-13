declare module 'redis-mock' {

    import { RedisClient } from 'redis'

    export class RedisMockInstance {
        createClient(): RedisClient
    }

    const instance: RedisMockInstance
    export default instance
}