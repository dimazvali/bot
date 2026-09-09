var nodemailer = require('nodemailer');
var { getSubscribers } = require('./photo-subscriptions');
var photoUsers = require('./photo-users');

var BASE = 'https://photo.dimazvali.com';
var transporter = null;

function init() {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });
}

function makeHtml(photo, countryLabel, seriesLabel, countryKey, seriesKey, unsubUrl) {
  var photoUrl = `${BASE}/${countryKey}/${seriesKey}/${photo.id}`;
  var loc = `${countryLabel.toUpperCase()} · ${seriesLabel.toUpperCase()}${photo.date ? ' · ' + photo.date : ''}`;
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0d0d0d;">
<div style="font-family:monospace;max-width:520px;margin:0 auto;background:#0d0d0d;color:#ccc;padding:32px 24px;">
  <p style="font-size:9px;letter-spacing:3px;color:#555;margin:0 0 24px;">PHOTO.DIMAZVALI.COM</p>
  <h2 style="font-size:18px;font-weight:400;color:#fff;margin:0 0 6px;">${photo.title}</h2>
  <p style="font-size:9px;letter-spacing:2px;color:#444;margin:0 0 20px;">${loc}</p>
  ${photo.urls ? `<a href="${photoUrl}" style="display:block;margin-bottom:20px;"><img src="${photo.urls.preview}" style="width:100%;display:block;" /></a>` : ''}
  ${photo.desc ? `<p style="font-size:13px;line-height:1.7;color:#999;margin:0 0 20px;">${photo.desc}</p>` : ''}
  <a href="${photoUrl}" style="display:inline-block;font-size:9px;letter-spacing:2px;color:#fff;border:1px solid #444;padding:8px 16px;text-decoration:none;">СМОТРЕТЬ →</a>
  <p style="font-size:8px;color:#333;margin-top:32px;padding-top:16px;border-top:1px solid #1e1e1e;">
    <a href="${unsubUrl}" style="color:#333;text-decoration:none;">отписаться</a>
  </p>
</div>
</body>
</html>`;
}

async function sendPhotoNotification(photo, { countryLabel, seriesLabel, countryKey, seriesKey }) {
  if (!transporter) return;
  var [emailSubs, googleSubs] = await Promise.all([getSubscribers(), photoUsers.getSubscribers()]);
  var seen = new Set();
  var subscribers = [];
  for (var s of emailSubs.concat(googleSubs)) {
    if (s.email && !seen.has(s.email)) { seen.add(s.email); subscribers.push(s); }
  }
  if (!subscribers.length) return;

  for (var sub of subscribers) {
    var unsubUrl = `${BASE}/unsubscribe?token=${sub.token}`;
    var html = makeHtml(photo, countryLabel, seriesLabel, countryKey, seriesKey, unsubUrl);
    await transporter.sendMail({
      from: `"Дмитрий Шестаков" <${process.env.GMAIL_USER}>`,
      to: sub.email,
      subject: `${photo.title} — photo.dimazvali.com`,
      html,
    }).catch(err => console.error('[mailer] failed for', sub.email, err.message));
  }
  console.log(`[mailer] sent to ${subscribers.length} subscribers`);
}

async function sendCopyrightAlert(hits) {
  if (!transporter || !process.env.GMAIL_USER) return;

  var grouped = {};
  hits.forEach(function(h) {
    var key = h.countryKey + '/' + h.seriesKey + '/' + h.photo.id;
    if (!grouped[key]) {
      grouped[key] = { photo: h.photo, countryKey: h.countryKey, seriesKey: h.seriesKey, matches: [] };
    }
    grouped[key].matches.push({
      matchUrl: h.matchUrl, matchType: h.matchType, partial: h.partial,
      pageUrl: h.pageUrl, pageTitle: h.pageTitle,
    });
  });

  var rows = Object.values(grouped).map(function(g) {
    var matchList = g.matches.map(function(m) {
      var tag = (m.matchType === 'page' ? 'страница' : 'файл') + (m.partial ? ' · частичное' : '');
      var pageLine = (m.matchType !== 'page' && m.pageUrl)
        ? '<br><span style="color:#777;">на странице: </span><a href="' + m.pageUrl + '" style="color:#555;word-break:break-all;">' + (m.pageTitle || m.pageUrl) + '</a>'
        : '';
      var title = (m.matchType === 'page' && m.pageTitle) ? '<span style="color:#888;">' + m.pageTitle + '</span><br>' : '';
      return '<tr><td style="padding:3px 0;font-size:11px;color:#666;">'
        + '<span style="font-size:9px;letter-spacing:1px;color:#555;">' + tag + '</span><br>'
        + title
        + '<a href="' + m.matchUrl + '" style="color:#555;word-break:break-all;">' + m.matchUrl + '</a>'
        + pageLine
        + '</td></tr>';
    }).join('');
    return '<tr style="border-top:1px solid #1e1e1e;"><td style="padding:12px 0;">'
      + '<p style="margin:0 0 4px;font-size:13px;color:#ccc;">' + g.photo.title + '</p>'
      + '<p style="margin:0 0 8px;font-size:9px;letter-spacing:2px;color:#444;">' + g.countryKey.toUpperCase() + ' · ' + g.seriesKey.toUpperCase() + '</p>'
      + '<table style="width:100%;border-collapse:collapse;">' + matchList + '</table>'
      + '</td></tr>';
  }).join('');

  var html = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0d0d0d;">'
    + '<div style="font-family:monospace;max-width:600px;margin:0 auto;background:#0d0d0d;color:#ccc;padding:32px 24px;">'
    + '<p style="font-size:9px;letter-spacing:3px;color:#555;margin:0 0 24px;">PHOTO.DIMAZVALI.COM · COPYRIGHT ALERT</p>'
    + '<h2 style="font-size:16px;font-weight:400;color:#fff;margin:0 0 20px;">Найдено ' + hits.length + ' новых использований</h2>'
    + '<table style="width:100%;border-collapse:collapse;">' + rows + '</table>'
    + '</div></body></html>';

  await transporter.sendMail({
    from: '"photo.dimazvali.com" <' + process.env.GMAIL_USER + '>',
    to: process.env.GMAIL_USER,
    subject: 'Copyright alert: ' + hits.length + ' новых использований ваших фото',
    html,
  });
  console.log('[mailer] copyright alert sent');
}

module.exports = { init, sendPhotoNotification, sendCopyrightAlert };
