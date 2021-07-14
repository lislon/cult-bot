

export interface MapMarkerProps {
    lat: number
    lng: number
    id: number
    onSelected?: (id: number) => void
}