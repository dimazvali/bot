'use strict';
var nodemailer = require('nodemailer');

var transporter = null;
function init() {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
  });
}

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

var COPY = {
  en: {
    subject: 'Sign in to events.tbiliseli.com',
    heading: 'Sign in',
    body: 'Click the button below to sign in. The link works once and expires in 30 minutes.',
    button: 'Sign in',
    ignore: 'If you did not request this, you can ignore this email.',
  },
  ru: {
    subject: 'Вход на events.tbiliseli.com',
    heading: 'Вход',
    body: 'Нажмите кнопку ниже, чтобы войти. Ссылка одноразовая и действует 30 минут.',
    button: 'Войти',
    ignore: 'Если вы не запрашивали вход — просто проигнорируйте это письмо.',
  },
  ka: {
    subject: 'შესვლა events.tbiliseli.com-ზე',
    heading: 'შესვლა',
    body: 'დააჭირეთ ქვემოთ ღილაკს შესასვლელად. ბმული ერთჯერადია და მოქმედებს 30 წუთი.',
    button: 'შესვლა',
    ignore: 'თუ თქვენ არ მოგითხოვიათ — უბრალოდ იგნორირება გაუკეთეთ ამ წერილს.',
  },
};

function copyFor(lang) { return COPY[lang] || COPY.en; }

function buildMagicLinkEmail(url, lang) {
  var c = copyFor(lang);
  var safeUrl = escHtml(url);
  var html = '<!DOCTYPE html><html><body style="margin:0;background:#faf6f0;">'
    + '<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#14110e;">'
    + '<p style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8b8175;margin:0 0 18px;">events.tbiliseli.com</p>'
    + '<h1 style="font-size:20px;font-weight:700;margin:0 0 12px;">' + c.heading + '</h1>'
    + '<p style="font-size:14px;line-height:1.5;margin:0 0 20px;">' + c.body + '</p>'
    + '<p style="margin:0 0 22px;"><a href="' + safeUrl + '" style="display:inline-block;background:#14110e;color:#fffdf9;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;">' + c.button + '</a></p>'
    + '<p style="font-size:12px;color:#6f665c;word-break:break-all;margin:0 0 18px;">' + safeUrl + '</p>'
    + '<p style="font-size:12px;color:#8b8175;margin:0;">' + c.ignore + '</p>'
    + '</div></body></html>';
  var text = c.heading + '\n\n' + c.body + '\n\n' + url + '\n\n' + c.ignore;
  return { subject: c.subject, html: html, text: text };
}

async function sendMagicLink(email, url, lang) {
  if (!transporter) return;
  var msg = buildMagicLinkEmail(url, lang);
  await transporter.sendMail({
    from: '"events.tbiliseli.com" <' + process.env.GMAIL_USER + '>',
    to: email,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
  });
}

module.exports = { init: init, buildMagicLinkEmail: buildMagicLinkEmail, sendMagicLink: sendMagicLink, copyFor: copyFor };
