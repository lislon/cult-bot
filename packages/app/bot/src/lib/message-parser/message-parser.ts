import { Message, MessageEntity } from 'typegram'

export function parseTelegramMessageToHtml({text, entities}: Pick<Message.TextMessage, 'text' | 'entities'>) {
    function surroundWithTags(e: MessageEntity) {
        const contentString = text.substring(e.offset, e.offset + e.length)

        const typeToTag: any = {
            bold: 'b',
            italic: 'i',
            underline: 'u',
            strikethrough: 's',
        }

        if (typeToTag[e.type] !== undefined) {
            return '<' + typeToTag[e.type] + '>' + contentString + '</' + typeToTag[e.type] + '>'
        }
        if (e.type === 'text_link') {
            return `<a href="${e.url}">${contentString}</a>`
        }

        return contentString
    }

    let finalStr = ''
    let lastI = 0

    for (const e of (entities ?? []).filter(e => e.type !== 'hashtag')) {
        finalStr += text.substring(lastI, e.offset)
        finalStr += surroundWithTags(e)
        lastI = e.offset + e.length
    }
    finalStr += text.substring(lastI)
    return finalStr
}