// Shared client-side UI strings for photo.dimazvali.com — text built
// dynamically on the client (comments widget, share/subscribe feedback)
// rather than rendered server-side. Server-rendered strings live in
// lib/photo-i18n.js (Pug templates use its `ui` local) — this file covers
// the rest, so client scripts don't each carry their own copy.
// Loaded before main.js/subscribe.js and before comments.js is fetched, so
// window.PhotoI18n is always ready by the time any of them run.
window.PhotoI18n = (function () {
  var lang = document.documentElement.lang === 'en' ? 'en' : 'ru';

  var STRINGS = {
    ru: {
      shareCopied: 'СКОПИРОВАНО',
      subscribedEmail: '✓ вы подписаны (почта)',
      commentsEmpty: 'КОММЕНТАРИЕВ ЕЩЁ НЕТ',
      commentsOne: 'КОММЕНТАРИЙ',
      commentsFew: 'КОММЕНТАРИЯ',
      commentsMany: 'КОММЕНТАРИЕВ',
      commentsHide: 'СКРЫТЬ',
      commentsSignOut: 'ВЫЙТИ',
      commentsWritePlaceholder: 'НАПИСАТЬ КОММЕНТАРИЙ...',
      commentsSubmit: 'ОТПРАВИТЬ →',
      commentsSignInNote: 'ВОЙДИТЕ, ЧТОБЫ ОСТАВИТЬ КОММЕНТАРИЙ',
      commentsSignInGoogle: 'ВОЙТИ ЧЕРЕЗ GOOGLE',
      commentsLoadError: 'ОШИБКА ЗАГРУЗКИ',
      pointArmed: 'КЛИКНИ ПО ФОТО', pointEmptyError: 'Введите текст', pointSaveError: 'Ошибка сохранения',
      pointAuthorPrefix: 'гость:',
    },
    en: {
      shareCopied: 'COPIED',
      subscribedEmail: '✓ subscribed (email)',
      commentsEmpty: 'NO COMMENTS YET',
      commentsOne: 'COMMENT',
      commentsFew: 'COMMENTS',
      commentsMany: 'COMMENTS',
      commentsHide: 'HIDE',
      commentsSignOut: 'SIGN OUT',
      commentsWritePlaceholder: 'WRITE A COMMENT...',
      commentsSubmit: 'SEND →',
      commentsSignInNote: 'SIGN IN TO LEAVE A COMMENT',
      commentsSignInGoogle: 'SIGN IN WITH GOOGLE',
      commentsLoadError: 'FAILED TO LOAD',
      pointArmed: 'CLICK ON PHOTO', pointEmptyError: 'Enter some text', pointSaveError: 'Save error',
      pointAuthorPrefix: 'guest:',
    },
  };

  return {
    lang: lang,
    t: STRINGS[lang],
    dateLocale: lang === 'en' ? 'en-GB' : 'ru-RU',
  };
}());
