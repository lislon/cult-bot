import { getSurveyData } from '../../../src/lib/middleware/support-feedback.middleware'

describe('get survey', () => {
    test('get survey', () => {

        const msg = `
        Как провели время?
        
        Опрос:
        id: test
         [ Прекрасно ]
         [ Норм ]
        `
        const actual = getSurveyData(msg)

        expect(actual).toEqual({
            id: 'test',
            question: 'Как провели время?',
            options: ['Прекрасно', 'Норм']
        })
    })

})