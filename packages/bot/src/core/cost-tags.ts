import { CHEAP_PRICE_THRESHOLD, Event, TagLevel2 } from '../interfaces/app-interfaces'
import { parsePrice } from '../lib/price-parser'

export function autoAppendCostTags(existingTags: TagLevel2[], data: Event, errorCallback?: (errors: string[]) => void, warningCallback?: (errors: string[]) => void): TagLevel2[] {
    const tagFree: TagLevel2 = '#бесплатно'
    const tagCheap: TagLevel2 = '#доступноподеньгам'
    const tagNotCheap: TagLevel2 = '#_недешево'

    const tagFreeIncl = existingTags.includes(tagFree)
    const tagCheapIncl = existingTags.includes(tagCheap)

    if (tagFreeIncl) {
        warningCallback?.([`Тег ${tagFree} ставится автоматически. Уберите, плиз его из карточки`])
    }
    if (tagCheapIncl) {
        warningCallback?.([`Тег ${tagCheap} ставится автоматически. Уберите, плиз его из карточки`])
    }

    const priceParsed = parsePrice(data.price)

    if (priceParsed.type === 'free') {
        if (!tagFreeIncl) {
            existingTags.push(tagFree)
        }
    } else if (priceParsed.type === 'paid') {
        if (priceParsed.min <= CHEAP_PRICE_THRESHOLD && !tagCheapIncl) {
            existingTags.push(tagCheap)
        }
    }
    if (!existingTags.includes(tagFree) && !existingTags.includes(tagCheap)) {
        existingTags.push(tagNotCheap)
    }
    return existingTags
}