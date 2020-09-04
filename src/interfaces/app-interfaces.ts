import { SceneContextMessageUpdate } from 'telegraf/typings/stage'
import { I18n } from 'telegraf-i18n'

export type EventCategory = 'theaters' | 'exhibitions' | 'movies' | 'events' | 'walks' | 'concerts'
export const allCategories: EventCategory[] = ['theaters', 'exhibitions', 'movies', 'events', 'walks', 'concerts']

export interface ContextMessageUpdate extends SceneContextMessageUpdate {
    i18n: I18n;
    scene: any;
    session: {
        // movies: IMovie[] | ISearchResult[];
        settingsScene: {
            messagesToDelete: any[];
        };
        language: 'en' | 'ru';
    };
    movie: any;
    webhookReply: boolean;
}

export interface Event {
    category: string
    publish: string
    subcategory: string
    title: string
    place: string
    address: string
    timetable: string
    duration: string
    price: string
    notes: string
    description: string
    url: string
    tag_level_1: string
    tag_level_2: string
    tag_level_3: string
    rating: number
    reviewer: string
}