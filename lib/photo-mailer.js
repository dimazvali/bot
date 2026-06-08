var nodemailer = require('nodemailer');
var { getSubscribers } = require('./photo-subscriptions');

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
  var subscribers = await getSubscribers();
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

module.exports = { init, sendPhotoNotification };
