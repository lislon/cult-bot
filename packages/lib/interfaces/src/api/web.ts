export interface AllExhibitionsRequest {
    limit: number
}

export interface Exhibition {
    id: number
    lat: number
    lng: number
    title: string
}

export interface AllExhibitionsResponse {
    exhibitions: [
        Exhibition
    ]
}