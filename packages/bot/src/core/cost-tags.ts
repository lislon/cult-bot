import { CHEAP_PRICE_THRESHOLD, Event, TagLevel2 } from '../interfaces/app-interfaces'
import { parsePrice } from '../lib/price-parser'

export function autoAppendCostTags(existingTags: TagLevel2[], data: Event, errorCallback?: (errors: string[]) => void, warningCallback?: (errors: string[]) => void): TagLevel2[] {
    const tagFree: TagLevel2 = '#бесплатно'
    const tagCheap: TagLevel2 = '#доступноподеньгам'
    const tagNotCheap: TagLevel2 = '#_недешево'

    const tagFreeIncl = existingTags.includes(tagFree)
    const tagCheapIncl = existingTags.includes(tagCheap)

    if (tagFreeIncl && tagCheapIncl) {
        errorCallback?.([`Теги ${tagFree} и ${tagCheap} не могут быть вместе`])
    }

    const priceParsed = parsePrice(data.price)

    if (priceParsed.type === 'free') {
        if (!tagFreeIncl) {
            existingTags.push(tagFree)
            warningCallback?.([`Бот добавил тег ${tagFree}, тут тоже хорошо бы поправить`])
        }
    } else if (priceParsed.type === 'paid') {
        if (priceParsed.min <= CHEAP_PRICE_THRESHOLD && !tagCheapIncl) {
            existingTags.push(tagCheap)
            warningCallback?.([`Бот добавил тег ${tagCheap}, тут тоже хорошо бы поправить`])
        } else if (priceParsed.min > CHEAP_PRICE_THRESHOLD && (tagCheapIncl || tagFreeIncl)) {
            warningCallback?.([`Дороговатое событие для тегов ${tagCheap} или ${tagFree}`])
        }
    }
    if (!existingTags.includes(tagFree) && !existingTags.includes(tagCheap)) {
        existingTags.push(tagNotCheap)
    }
    return existingTags
}