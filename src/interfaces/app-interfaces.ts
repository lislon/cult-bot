import { SceneContextMessageUpdate } from 'telegraf/typings/stage'
import { I18n } from 'telegraf-i18n'

export type EventCategory = 'theaters' | 'exhibitions' | 'movies' | 'events' | 'walks' | 'concerts'

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