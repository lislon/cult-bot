export type EventPriceMode = 'free'|'paid'|'donation'|'unknown'|'other'

export interface EventPrice {
    type: EventPriceMode
    min?: number
    max?: number
    comment?: string
}

export function replaceRubWithSign(text: string) {
    return text.replace(/\s*(руб|рублей|р\.|руб\.)(\s|$|,)/g, ' ₽$2')
}

export function formatPrice(eventPrice: EventPrice): string {
    function formatPrice(price: number) {
        return price.toLocaleString('en-US').replace(',', ' ') + ' ₽'
    }
    function withComment(str: string) {
        if (eventPrice.comment) {
            return `${str}, ${replaceRubWithSign(eventPrice.comment)}`
        }
        return str
    }

    switch (eventPrice.type) {
        case 'donation':
            return withComment('донейшен')
        case 'free':
            return withComment('бесплатно')
        case 'other':
            return eventPrice.comment
        case 'paid': {
            const {min, max} = eventPrice
            if (min === max) {
                return withComment(formatPrice(min))
            }
            if (max == undefined) {
                return withComment(`от ${formatPrice(min)}`)
            }
            return withComment(`от ${formatPrice(min)} до ${formatPrice(max)}`)
        }
        default:
            return ''
    }
}

export function parsePrice(text: string): EventPrice {
    if (text === '') {
        return { type: 'unknown' }
    }
    const [priceText, comment] = text.split(/\s*,\s*/, 2)

    const priceTextFiltered = priceText
        .toLowerCase()
        .replace(/(\d)\s+(\d)/g, '$1$2')

    if (priceTextFiltered === 'донейшен' || priceText === 'донейшн') {
        return { type: 'donation', comment }
    } else if (priceTextFiltered === 'бесплатно') {
        return { type: 'free', comment }
    } else {
        const rangeMatch = priceTextFiltered.match(/от.+?(\d+).+?до.+?(\d+)/)
        if (rangeMatch) {
            return {
                type: 'paid',
                comment,
                min: +rangeMatch[1],
                max: +rangeMatch[2],
            }
        }

        const fromMatch = priceTextFiltered.match(/от.+?(\d+)/)

        if (fromMatch) {
            return {
                type: 'paid',
                comment,
                min: +fromMatch[1],
                max: undefined,
            }
        }

        const exactMatch = priceTextFiltered.match(/[^\d]*(\d+)[^\d]*/)
        if (exactMatch) {
            return {
                type: 'paid',
                comment,
                min: +exactMatch[1],
                max: +exactMatch[1],
            }
        }
        return {
            type: 'other',
            comment: text
        }
    }

}