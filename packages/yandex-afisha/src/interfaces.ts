export type ParseType = 'orig' | 'snapshot';

export interface PlaceWithMeta extends Place {
    parseDate: Date
}

export interface Place {
    distance: any
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
                "discount": any,
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