import { Markup, ContextMessageUpdate } from 'telegraf';

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
  const theaters = ctx.i18n.t('keyboards.main_keyboard.theaters');
  const exhibitions = ctx.i18n.t('keyboards.main_keyboard.exhibitions');
  const movies = ctx.i18n.t('keyboards.main_keyboard.movies');
  const events = ctx.i18n.t('keyboards.main_keyboard.events');
  const walks = ctx.i18n.t('keyboards.main_keyboard.walks');
  const concerts = ctx.i18n.t('keyboards.main_keyboard.concerts');
  let mainKeyboard: any = Markup.keyboard([
    [theaters, exhibitions] as any,
    [movies, events],
    [walks, concerts]
  ]);
  mainKeyboard = mainKeyboard.resize().extra();

  return {
    mainKeyboard,
    theaters,
    exhibitions,
    movies,
    events,
    walks,
    concerts
  };
};
