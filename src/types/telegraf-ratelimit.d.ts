import { ContextMessageUpdate } from '../interfaces/app-interfaces'

declare module 'telegraf-ratelimit' {

    export interface RateLimitConfig {
        window: number,
        limit: number,
        onLimitExceeded: (ctx: ContextMessageUpdate, next: () => any) => void,
        keyGenerator?: (ctx: ContextMessageUpdate) => any
    }

    export default function rateLimit(config: RateLimitConfig): any;
}
