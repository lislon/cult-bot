import { Markup, Extra } from 'telegraf';
import { ContextMessageUpdate, EventCategory } from '../interfaces/app-interfaces'

/**
 * Returns back keyboard and its buttons according to the language
 * @param ctx - telegram context
 */
export const getBackKeyboard = (ctx: ContextMessageUpdate) => {
  const backKeyboardBack = ctx.i18n.t('keyboards.back_keyboard.back');
  let backKeyboard: any = Markup.keyboard([backKeyboardBack]);

  backKeyboard = backKeyboard.resize().extra();

  return {
    backKeyboard,
    backKeyboardBack
  };
};

/**
 * Returns main keyboard and its buttons according to the language
 * @param ctx - telegram context
 */
export const getMainKeyboard = (ctx: ContextMessageUpdate) => {
  const menu = [
    [ 'theaters', 'exhibitions' ],
    [ 'movies', 'events' ],
    [ 'walks', 'concerts' ],
    [ 'customize' ]
  ]
  const mainKeyboard = menu.map(row =>
    row.map(slug => {
      const title = ctx.i18n.t(`keyboards.main_keyboard.${slug}`);
      return Markup.callbackButton(title, slug);
    })
  );
  return { mainKeyboard: Extra.markup(Markup.inlineKeyboard(mainKeyboard)) }
};
