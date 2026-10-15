'use strict';
// Side menu of the photo admin (views/photo/admin/layout.pug). A page picks its item with
// `- var nav = '<key>'` inside `block vars`; the layout calls navFor(nav) via the `adminNav` local.
var NAV_GROUPS = [
  { label: 'Контент', items: [
    { key: 'dashboard', label: 'Дашборд', href: '/admin' },
    { key: 'shoots', label: 'Съёмки', href: '/admin/shoots' },
    { key: 'series', label: 'Серии и страны', href: '/admin/series' },
    { key: 'images', label: 'Изображения', href: '/admin/images' },
  ] },
  { label: 'Люди', items: [
    { key: 'people', label: 'Люди', href: '/admin/people' },
    { key: 'tags', label: 'Теги', href: '/admin/tags' },
  ] },
  { label: 'Входящие', items: [
    { key: 'leads', label: 'Лиды', href: '/admin/leads' },
    { key: 'feedback', label: 'Отзывы и метки', href: '/admin/feedback' },
    { key: 'subscribers', label: 'Подписчики', href: '/admin/subscribers' },
  ] },
  { label: 'Аналитика', items: [
    { key: 'stats', label: 'Статистика', href: '/admin/stats' },
    { key: 'copyright', label: 'Использования', href: '/admin/copyright' },
  ] },
  { label: 'Система', items: [
    { key: 'site-texts', label: 'Тексты сайта', href: '/admin/site-texts' },
    { key: 'settings', label: 'Настройки', href: '/admin/settings' },
  ] },
];

var NAV_KEYS = NAV_GROUPS.reduce(function(keys, g) {
  return keys.concat(g.items.map(function(i) { return i.key; }));
}, []);

// Fresh copies, so a render never mutates the shared config.
function navFor(activeKey) {
  return NAV_GROUPS.map(function(g) {
    return {
      label: g.label,
      items: g.items.map(function(i) { return Object.assign({}, i, { active: i.key === activeKey }); }),
    };
  });
}

module.exports = { NAV_GROUPS: NAV_GROUPS, NAV_KEYS: NAV_KEYS, navFor: navFor };
