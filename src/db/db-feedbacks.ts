import { ColumnSet, IDatabase, IMain } from 'pg-promise'

export class FeedbackData {
    userId: number
    feedbackText: string
}

export class FeedbackRepository {
    private readonly columns: ColumnSet

    constructor(private db: IDatabase<any>, private pgp: IMain) {
        this.columns = new pgp.helpers.ColumnSet(
            'user_id, feedback_text'.split(/,\s*/),
            { table: 'cb_feedbacks' }
        );
    }

    public async saveFeedback(feedbackData: FeedbackData): Promise<number> {
        const sql = this.pgp.helpers.insert({
            user_id: +feedbackData.userId,
            feedback_text: feedbackData.feedbackText
        }, this.columns) + ' returning id'
        return +(await this.db.one(sql))['id']
    }
}

