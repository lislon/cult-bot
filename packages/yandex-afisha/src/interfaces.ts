import { ParsedEvent, ParsedEventToSave } from './database/parsed-event'
import { Deleted, WithId } from '@culthub/universal-db-sync'

export type DeletedColumns = 'category'|'title'

export interface PlaceWithMeta extends Place {
    parseDate: Date
}

export interface Place {
    distance: unknown
    event: {
        id: string,
        url: string,
        permanent: false,
        systemTags: { code: string }[],
        title: string
        originalTitle: string
        argument: string,
        contentRating: string,
        kinopoisk: string,
        type: {
            id: string,
            code: 'concert',
            name: string,
        },
        tags: { code: string, name: string }[],
        tickets:
            {
                price: {
                    "currency": "rub",
                    "min": number,
                    "max": number
                },
                "discount": unknown,
                saleStatus: 'available',
            }[],
        "image": {
            "source": {
                "title": string
            },
            "sizes": {
                "eventCover": {
                    "url": string,
                },
            }
        },
    },
    scheduleInfo: {
        "collapsedText": string
        "dateEnd": string
        "dateStarted": string
        "dateReleased": string
        "placePreview": string
        permanent: boolean
        "dates": string[]
    }
}

export type ParsedEventField = keyof ParsedEvent

export type WithBotExtId = {
    botExtId?: string
}

export interface DiffReport {
    inserted: (ParsedEventToSave & WithBotExtId)[]
    updated: (WithId<ParsedEventToSave> & { diffFields: ParsedEventField[] } & WithBotExtId)[]
    deleted: (Deleted<DeletedColumns> & WithBotExtId)[]
    notChangedCount: number
}