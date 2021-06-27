import { mapKeys, mapValues } from 'lodash'
import { ColumnSet, IDatabase, IMain } from 'pg-promise'
import { IExtensions } from './db'


export interface FeedbackData {
    userId: number
    feedbackText: string
    messageId: number
    adminChatId: number
    adminMessageId: number
}

export interface QuizPersistent {
    userId: number
    isFound: boolean
    why_not_like?: string[]
    what_is_important?: string[]
}

export interface QuizMailing {
    userId: number
    question: string
    answer: string
}

export interface QuizRow {
    answer_opt: string
    count: number
}

export interface QueryUserFeedbackMsgId {
    admin_chat_id: number
    admin_message_id: number
}

export interface ResultUserFeedbackMsgId {
    tid: number
    message_id: number
}

export class FeedbackRepository {
    private readonly columnsFeedback: ColumnSet
    private readonly columnsSurvey: ColumnSet

    private readonly QUIZ_PERSISTENT_VERSION = 'is_found_event'

    constructor(private db: IDatabase<IExtensions>, private pgp: IMain) {
        this.columnsFeedback = new pgp.helpers.ColumnSet(
            'user_id, feedback_text, message_id, admin_chat_id, admin_message_id'.split(/,\s*/),
            {table: 'cb_feedbacks'}
        )
        this.columnsSurvey = new pgp.helpers.ColumnSet(
            'user_id, answers'.split(/,\s*/),
            {table: 'cb_survey'}
        )

    }

    public async saveFeedback(feedbackData: FeedbackData): Promise<number> {
        const sql = this.pgp.helpers.insert({
            user_id: +feedbackData.userId,
            message_id: feedbackData.messageId,
            feedback_text: feedbackData.feedbackText,
            admin_chat_id: feedbackData.adminChatId,
            admin_message_id: feedbackData.adminMessageId
        }, this.columnsFeedback) + ' returning id'
        return +(await this.db.one(sql))['id']
    }

    public async findFeedbackMessage(query: QueryUserFeedbackMsgId): Promise<ResultUserFeedbackMsgId | null> {
        return await this.db.oneOrNone(`
            SELECT cu.tid, cf.message_id
            FROM cb_feedbacks cf
            JOIN cb_users cu ON (cu.id = cf.user_id)
            WHERE cf.admin_chat_id = $(admin_chat_id) AND cf.admin_message_id = $(admin_message_id)
        `, query)
    }

    private static isPersistentQuiz(quizData: QuizPersistent | QuizMailing): quizData is QuizPersistent {
        return 'isFound' in quizData
    }

    public async saveQuiz(quizData: QuizPersistent | QuizMailing): Promise<number> {
        const getData = () => {
            if (FeedbackRepository.isPersistentQuiz(quizData)) {
                return {
                    v: this.QUIZ_PERSISTENT_VERSION,
                    is_found: quizData.isFound,
                    why_not_like: quizData.why_not_like,
                    what_is_important: quizData.what_is_important
                }
            } else {
                return {
                    v: quizData.question,
                    answer: quizData.answer
                }
            }
        }

        const sql = this.pgp.helpers.insert({
            user_id: +quizData.userId,
            answers: getData()
        }, this.columnsSurvey) + ' returning id'
        return +(await this.db.one(sql))['id']
    }

    public async getQuizStats(): Promise<string> {
        const positiveRows = await this.db.manyOrNone<QuizRow>(this.statSql('what_is_important'))
        const negativeRows = await this.db.manyOrNone<QuizRow>(this.statSql('why_not_like'))

        return JSON.stringify({
            what_is_important: this.countByKey(positiveRows),
            why_not_like: this.countByKey(negativeRows)
        }, undefined, 2)
    }

    private countByKey(positiveRows: QuizRow[]) {
        const keys = mapKeys(positiveRows, 'answer_opt')
        return mapValues(keys, (v) => +v.count)
    }

    private statSql(type: 'what_is_important' | 'why_not_like') {
        return `
            select answer_opt, COUNT(answer_opt) as count
            from cb_survey cs
            join (
                select user_id, MAX(created_at)  as  created_at
                from cb_survey cs
                where cs.answers ->> 'v' = 'is_found_event'
                group by user_id
            ) b on (b.user_id = cs.user_id and b.created_at = cs.created_at )
            , jsonb_array_elements_text(cs.answers -> '${type}') AS answer_opt
            where cs.answers ->> 'is_found' = '${type === 'what_is_important' ? 'true' : 'false'}'
            group by answer_opt
            order by COUNT(answer_opt) DESC
        `
    }
}

