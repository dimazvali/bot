'use strict';
var nodemailer = require('nodemailer');
var transporter = null;

function init() {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
  });
}

async function sendRequestNotification(request) {
  if (!transporter || !process.env.EKA_NOTIFY_EMAIL) return;
  var subject = request.type === 'tour'
    ? 'Новая заявка на тур: ' + (request.tourTitle || '')
    : 'Новая заявка на направление: ' + (request.directionSlug || '');
  var contactLine = request.contactType.toUpperCase() + ': ' + request.contact;
  var html = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0d0d0d;">'
    + '<div style="font-family:monospace;max-width:520px;margin:0 auto;background:#0d0d0d;color:#ccc;padding:32px 24px;">'
    + '<p style="font-size:9px;letter-spacing:3px;color:#555;margin:0 0 20px;">EKA.DIMAZVALI.COM · НОВАЯ ЗАЯВКА</p>'
    + '<h2 style="font-size:16px;font-weight:400;color:#fff;margin:0 0 20px;">' + subject + '</h2>'
    + '<table style="width:100%;border-collapse:collapse;">'
    + makeRow('Имя', request.name)
    + makeRow('Контакт', contactLine)
    + (request.preferredDates ? makeRow('Даты', request.preferredDates) : '')
    + (request.message ? makeRow('Сообщение', request.message) : '')
    + makeRow('Язык', request.lang)
    + makeRow('Тип', request.type)
    + '</table>'
    + '</div></body></html>';
  await transporter.sendMail({
    from: '"eka.dimazvali.com" <' + process.env.GMAIL_USER + '>',
    to: process.env.EKA_NOTIFY_EMAIL,
    subject: subject,
    html: html,
  });
}

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function makeRow(label, value) {
  return '<tr><td style="padding:6px 0;font-size:9px;letter-spacing:2px;color:#555;width:100px;">'
    + label.toUpperCase() + '</td>'
    + '<td style="padding:6px 0;font-size:12px;color:#ccc;">' + escHtml(value) + '</td></tr>';
}

module.exports = { init, sendRequestNotification };
