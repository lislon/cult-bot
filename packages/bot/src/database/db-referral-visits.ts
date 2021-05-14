import { ColumnSet, IDatabase, IMain } from 'pg-promise'
import { fieldInt, fieldInt8Array, fieldStr, fieldTimestamptzNullable } from '@culthub/pg-utils'

export interface ReferralVisitData {
    userId: number
    referralId: number
    visitAt?: Date
}

export interface DbReferralVisit {
    id: number
    user_id: number
    referral_id: number
    visit_at?: Date
}

export class ReferralVisitRepository {
    private readonly columns: ColumnSet

    constructor(private db: IDatabase<unknown>, private pgp: IMain) {
        this.columns = new pgp.helpers.ColumnSet([
                fieldInt('user_id'),
                fieldStr('referral_id'),
                fieldTimestamptzNullable('visit_at'),
            ],
            {table: 'cb_referral_visits'}
        )
    }

    public async insert(visit: ReferralVisitData): Promise<number> {
        const rawData: Omit<DbReferralVisit, 'id'> = {
            referral_id: visit.referralId,
            user_id: visit.userId,
            visit_at: visit.visitAt
        }
        const sql = this.pgp.helpers.insert(rawData, this.columns) + ' returning id'
        return +(await this.db.one(sql))['id']
    }
}

