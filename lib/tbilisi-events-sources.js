'use strict';

// Each entry: { type: 'telegram' | 'website' | 'facebook' | 'facebook_group' | 'instagram' | 'tkt', value: string, label: string }
// telegram: value = channel username without the leading @
// website / facebook (page) / facebook_group / instagram: value = full page URL
// facebook_group only works with public groups
// tkt: value is unused (collectTkt hits tkt.ge's own API directly); returns structured events, no LLM extraction
module.exports = [
  { type: 'telegram', value: 'interestingGeorgia', label: 'interestingGeorgia' },
  { type: 'telegram', value: 'ProGeorgian', label: 'ProGeorgian' },
  { type: 'telegram', value: 'paperkartuli', label: 'paperkartuli' },
  { type: 'telegram', value: 'auditoria_tbilisi', label: 'auditoria_tbilisi' },
  { type: 'telegram', value: 'kakhetiannewsru', label: 'kakhetiannewsru' },
  { type: 'telegram', value: 'tbilisieda', label: 'tbilisieda' },
  { type: 'facebook', value: 'https://www.facebook.com/kakhetiannews', label: 'kakhetiannews' },
  { type: 'telegram', value: 'nateli_tbilisi', label: 'nateli_tbilisi' },
  { type: 'telegram', value: 'tbilisi_long_stay', label: 'tbilisi_long_stay' },
  { type: 'tkt', value: 'https://tkt.ge', label: 'tkt.ge' },
];
