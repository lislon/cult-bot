import { UserState } from '../../src/lib/middleware/user-middleware'
import { Event, MySession, MySessionTmp } from '../../src/interfaces/app-interfaces'

export const MOCK_SESSION_USER_STATE: UserState = {
    id: 1,
    lastDbUpdated: 0,
    eventsFavorite: [],
    version: '',
    clicks: 0,
    showTags: false,
    isPaid: false
}
export const MOCK_SESSION: MySession = {
    user: MOCK_SESSION_USER_STATE,
    __scenes: {
        current: ''
    }
}

export const MOCK_SESSION_TMP: MySessionTmp = {
    analyticsScene: {
        viewedEvents: []
    },
    userScene: {
        firstTimeUser: false
    }
}

export const MOCK_EVENT: Event = {
    id: 1,
    extId: '',
    title: 'A',
    category: 'theaters',
    description: 'описание',
    timetable: `17 октября: 11:30 - 23:45`,
    notes: 'notes',
    price: '100 руб',
    duration: '2 часа',
    address: '',
    tag_level_1: ['#level1'],
    tag_level_2: ['#комфорт', '#_недешево'],
    tag_level_3: ['#level3'],
    rating: 15,
    geotag: '',
    publish: '',
    place: '',
    url: '',
    reviewer: '',
    likes: 0,
    dislikes: 0
}

