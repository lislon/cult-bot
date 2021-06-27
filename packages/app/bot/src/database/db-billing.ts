import { ColumnSet, IDatabase, IMain } from 'pg-promise'
import { fieldInt, fieldTimestamptzNullable } from '@culthub/pg-utils'
import { TcsPaymentNotification } from '../api-external-server/interface/tcs-types'


export interface PaymentsListRequest {
    userId: number
}

export interface CreateInvoiceRequest {
    userId: number
    amount: number
    subscriptionId: number
}

export type UpdatePaymentRequest = Partial<Pick<Payment, 'rejectedAt' | 'refundedAt' | 'paidAt'>> & Pick<Payment, 'id'>

export interface MarkInvoiceRejectedRequest {
    paymentId: number
    rejectedAt: Date
}

export interface FindUnpaidPayment {
    userId: number
    amount: number
    days: number
}

export interface FindPaidPayments {
    userId: number
}

export interface PaymentRowDb {
    id: number
    user_id: number
    subscription_id: number
    amount: number
    paid_at?: Date
    refunded_at?: Date
    rejected_at?: Date
    updated_at: Date
}

export interface Payment {
    id: number
    subscriptionId: number
    amount: number
    paidAt?: Date
    refundedAt?: Date
    rejectedAt?: Date
}

export interface PaymentNotificationDb {
    details: string
}

export const PAYMENT_NOTIFICATIONS_TABLE = 'cb_billing_payments_notifications'
export const PAYMENT_TABLE = 'cb_billing_payments'

export class BillingRepository {
    private readonly columns: ColumnSet
    private readonly select = `cbp.id, cbp.subscription_id, cbp.amount, cbp.paid_at, cbp.refunded_at, cbp.rejected_at`

    constructor(private db: IDatabase<unknown>, private pgp: IMain) {
        this.columns = new pgp.helpers.ColumnSet([
                fieldInt('subscription_id'),
                fieldInt('amount'),
                fieldTimestamptzNullable('paid_at'),
                fieldTimestamptzNullable('refunded_at'),
                fieldTimestamptzNullable('rejected_at'),
            ],
            {table: PAYMENT_TABLE}
        )
    }

    public async savePaymentNotification(notification: TcsPaymentNotification): Promise<void> {
        const data: PaymentNotificationDb = {
            details: JSON.stringify(notification)
        }
        await this.db.none(this.pgp.helpers.insert(data, ['details'], PAYMENT_NOTIFICATIONS_TABLE))
    }

    public async createUnpaidPayment(r: CreateInvoiceRequest, now: Date = new Date()): Promise<number> {
        const rawData: Omit<PaymentRowDb, 'id'> = {
            user_id: r.userId,
            subscription_id: r.subscriptionId,
            amount: r.amount,
            updated_at: now,
            paid_at: undefined,
            rejected_at: undefined,
            refunded_at: undefined
        }
        const sql = this.pgp.helpers.insert(rawData, this.columns) + ' returning id'
        return +(await this.db.one(sql))['id']
    }

    public async updatePayment(r: UpdatePaymentRequest, now: Date = new Date()): Promise<void> {
        const rawData: Partial<PaymentRowDb> = {
            updated_at: now,
        }
        if (r.paidAt !== undefined) {
            rawData.paid_at = r.paidAt
        }
        if (r.refundedAt !== undefined) {
            rawData.refunded_at = r.refundedAt
        }
        if (r.rejectedAt !== undefined) {
            rawData.rejected_at = r.rejectedAt
        }
        await this.db.none(this.pgp.helpers.update(rawData, this.columns) + ' where id = $1', r.id)
    }

    public async getPayment(id: number): Promise<Payment | undefined> {
        return await this.db.oneOrNone(`
            select ${this.select}
            from ${PAYMENT_TABLE} cbp
            where id = $1 
        `, id, (r) => r !== null ? BillingRepository.mapPayment(r) : undefined) || undefined
    }

    private static mapPayment(row: PaymentRowDb): Payment {
        return {
            id: +row.id,
            amount: +row.amount,
            paidAt: row.paid_at || undefined,
            refundedAt: row.refunded_at || undefined,
            rejectedAt: row.rejected_at || undefined,
            subscriptionId: +row.subscription_id
        }
    }

    public async findUnpaidSubscription(payload: FindUnpaidPayment): Promise<number | undefined> {
        const sql = `
            SELECT MAX(cbp.id) AS id
            FROM cb_billing_payments cbp
            JOIN cb_subscriptions cs ON (cs.id = cbp.subscription_id)
            WHERE cbp.amount = $(amount) 
                AND cs.period_days = $(days) 
                AND cbp.paid_at IS NULL 
                AND cbp.rejected_at IS NULL
                AND cs.user_id = $(userId) 
        `
        return (await this.db.one(sql, payload, (r) => (r.id ? +r.id : undefined))) || undefined
    }

    public async listAllPayments(payload: FindPaidPayments): Promise<Payment[]> {
        const sql = `
            SELECT ${this.select}
            FROM cb_billing_payments cbp
            JOIN cb_subscriptions cs ON (cs.id = cbp.subscription_id)
            WHERE cs.user_id = $(userId) 
            ORDER BY cbp.id DESC
        `
        return await this.db.map(sql, payload, BillingRepository.mapPayment)
    }
}

