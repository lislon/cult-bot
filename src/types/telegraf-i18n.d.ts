import { I18n } from 'telegraf-i18n';

declare module 'telegraf-i18n' {
  // interface I18n {
  //   locale(languageCode: string): void;
  // }

  // node_modules\telegraf-i18n\lib\i18n.js:158
  // I18n.match = function (resourceKey, templateData) {
  //   return (text, ctx) => (text && ctx && ctx.i18n && text === ctx.i18n.t(resourceKey, templateData)) ? [text] : null
  // }
  export function match(resourceKey: string, templateData?: any): string;
  // export function qq(resourceKey: string, templateData?: any): string;

}
