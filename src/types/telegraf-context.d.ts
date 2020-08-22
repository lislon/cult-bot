import { I18n } from 'telegraf-i18n';
import { SceneContextMessageUpdate } from 'telegraf/typings/stage'

declare module 'telegraf' {

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
}
