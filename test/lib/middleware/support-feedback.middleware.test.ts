import { Markup } from 'telegraf'
import { getSurveyBtnsAndMsg } from '../../../src/lib/middleware/support-feedback.middleware'

describe('get survey', () => {
    test('get survey', () => {

        const msg = `
        Как провели время?
        
        Опрос:
         [ Прекрасно ]
         [ Норм ]
        `
        const actual = getSurveyBtnsAndMsg(msg)

        expect(actual).toEqual({
            text: 'Как провели время?',
            btns: [
                [Markup.button.callback('Прекрасно', 'mail_survey_prekrasno')],
                [Markup.button.callback('Норм', 'mail_survey_norm')]
            ],
            webPreview: false
        })
    })

})