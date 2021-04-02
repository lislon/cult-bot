import { parseTelegramMessageToHtml } from '../../../src/lib/message-parser/message-parser'
import { Message } from 'typegram'

describe('parse complex', () => {
    test('parse bold', () => {

        const message: Pick<Message.TextMessage, 'text' | 'entities'> = {
            text: '🎥 КИНО #игровоекино',
            entities: [
                {
                    offset: 3,
                    length: 4,
                    type: 'bold'
                },
                {
                    offset: 8,
                    length: 12,
                    type: 'hashtag'
                },
                {
                    offset: 8,
                    length: 12,
                    type: 'bold'
                },
            ]
        };

        const actual = parseTelegramMessageToHtml(message)
        expect(actual).toEqual('🎥 <b>КИНО</b> <b>#игровоекино</b>')
    })
})