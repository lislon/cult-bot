import { GeoPoint } from '../../database/db-events-geo'
import got from 'got'

export async function getLatLngByGeoTag(geotag: string): Promise<GeoPoint | undefined> {
    const request = await got(geotag).text()

    const searchString = 'yandexmaps://yandex.ru/maps/2/saint-petersburg/?ll='
    const start = request.indexOf(searchString)
    if (start >= 0) {
        const endPos = request.indexOf('&amp;', start)
        if (endPos >= 0) {
            const latlng = request.substring(start + searchString.length, endPos)
            const [lat, lng] = latlng.split('%2C')
            if (!isNaN(+lat) && !isNaN(+lng)) {
                return {
                    lat: +lat,
                    lng: +lng
                }
            }
        }
    }

    return undefined
}