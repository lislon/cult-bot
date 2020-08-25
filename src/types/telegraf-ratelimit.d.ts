import { ContextMessageUpdate } from 'telegraf'

declare module 'telegraf-ratelimit' {
    export interface RateLimitConfig {
        window: number,
        limit: number,
        onLimitExceeded: (ctx: ContextMessageUpdate, next: () => any) => void,
        keyGenerator?: (ctx: ContextMessageUpdate) => any
    }

    export function rateLimit(config: RateLimitConfig): any;
}
