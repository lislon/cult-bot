import { ContextMessageUpdate } from '../../interfaces/app-interfaces'
import { SessionEnforcer } from './shared-logic'
import { Composer, Middleware } from 'telegraf'

export interface PagingState {
    pagingOffset: number
    total?: number
}

export class Paging {
    static reset(ctx: ContextMessageUpdate) {
        Paging.prepareSession(ctx)
        ctx.session.paging = {
            pagingOffset: 0
        }
    }

    static prepareSession(ctx: ContextMessageUpdate) {
        ctx.session.paging = {
            pagingOffset: SessionEnforcer.number(ctx.session.paging?.pagingOffset),
            total: SessionEnforcer.number(ctx.session.paging?.total),
        }
    }

    static increment(ctx: ContextMessageUpdate, amount: number) {
        ctx.session.paging.pagingOffset += amount;
    }

    static pagingMiddleware(showMoreActionName: string, onNextAction: Middleware<ContextMessageUpdate>) {
        return new Composer()
            .action(/.+/, (ctx: ContextMessageUpdate, next) => {
                if (ctx.match[0] !== showMoreActionName) {
                    Paging.reset(ctx)
                }
                return next()
            })
            .hears(/.+/, (ctx: ContextMessageUpdate, next) => {
                Paging.reset(ctx)
                return next()
            })
            .action(showMoreActionName, onNextAction)
    }

}



