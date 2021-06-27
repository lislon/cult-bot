import { ColumnSet, IDatabase, IMain } from 'pg-promise'
import { fieldInt, fieldTimestamptzNullable } from '@culthub/pg-utils'

export const SUBSCRIPTIONS_TABLE = 'cb_subscriptions'

interface CreateSubscription {
    userId: number
    createdAt: Date
    activatedAt?: Date
    periodDays: number
}

interface UpdateSubscription {
    subscriptionId: number
    activatedAt: Date
}

interface Subscription {
    id: number
    userId: number
    createdAt: Date
    activatedAt?: Date
}

interface SubscriptionDb {
    user_id: number
    period_days: number
    created_at: Date
    activated_at?: Date
}

export class SubscriptionRepository {
    private readonly columns: ColumnSet

    constructor(private db: IDatabase<unknown>, private pgp: IMain) {
        this.columns = new pgp.helpers.ColumnSet([
                fieldInt('user_id'),
                fieldInt('period_days'),
                fieldTimestamptzNullable('created_at'),
                fieldTimestamptzNullable('activated_at')
            ],
            {table: SUBSCRIPTIONS_TABLE}
        )
    }

    public async createSubscription(payload: CreateSubscription): Promise<number> {
        const row: SubscriptionDb = {
            user_id: payload.userId,
            period_days: payload.periodDays,
            created_at: payload.createdAt,
            activated_at: payload.activatedAt
        }
        const sql = this.pgp.helpers.insert(row, this.columns) + ' returning id'
        return +(await this.db.one(sql))['id']
    }

    public async updateSubscription(payload: UpdateSubscription): Promise<boolean> {
        const rawData: Partial<SubscriptionDb> = {
            activated_at: payload.activatedAt,
        }
        const {rowCount} = await this.db.result(this.pgp.helpers.update(rawData, this.columns)
            + ' where id = $1', payload.subscriptionId)
        return rowCount > 0
    }

    public async getSubscriptions(userId: number): Promise<Subscription[]> {
        return await this.db.map(`
            select id, user_id, period_days, created_at, activated_at 
            from ${SUBSCRIPTIONS_TABLE} 
            where user_id = $1`, userId, ((row: SubscriptionDb & { id: number }) => ({
            id: +row.id,
            userId: +row.user_id,
            activatedAt: row.activated_at || undefined,
            createdAt: row.created_at
        })))
    }

}

