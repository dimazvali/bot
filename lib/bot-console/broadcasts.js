'use strict';
// Broadcasts from the bot console (ported from libo-guides-bot src/broadcasts.js).
//
// Text (Telegram HTML), optionally a picture by URL and one URL button.
// Segments: all — every user; photo — photo subscribers (photoSubscribed, set by /start photo_sub).
// Never sent to users blocked by an admin (blocked) or who blocked the bot (botBlocked).
//
// Flow: draft → "Отправить себе" (required after every edit: proves Telegram accepts the
// markup and shows how it looks) → start. Recipients are frozen at start; then a background
// loop sends ~20 msg/s, on 429 waits as long as Telegram says. Progress (cursor) is saved in
// the broadcast doc, so after a restart the bot continues where it stopped (resume()).
//
// status: draft → running ⇄ paused → done | cancelled
//
// store (async): list(), get(id), save(id, doc), users() → [{ id, blocked, botBlocked, photoSubscribed }],
//   markBlocked(userId)

var SEGMENTS = {
  all: 'Все пользователи бота',
  photo: 'Подписчики фото (/start photo_sub)',
};

var RATE_MS = 50;      // ~20 messages/s; Telegram's limit is about 30
var SAVE_EVERY = 50;   // how often progress is written to Firestore
var CAPTION_LIMIT = 1024;

class BroadcastError extends Error {}

function nowIso() { return new Date().toISOString(); }

class Broadcasts {
  constructor(opts) {
    this.store = opts.store;
    this.tg = opts.tg;
    this.rateMs = opts.rateMs != null ? opts.rateMs : RATE_MS;
    this.sleep = opts.sleep || function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };
    this.log = opts.log || function() {};
    this.running = null;   // promise of the background loop
    this.wanted = {};      // id → status set from the console while the loop runs (pause/cancel)
  }

  list() {
    return this.store.list().then(function(docs) {
      return docs.sort(function(a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
    });
  }

  get(id) { return this.store.get(id); }

  async mustGet(id) {
    var doc = await this.get(id);
    if (!doc) throw new BroadcastError('Нет такой рассылки');
    return doc;
  }

  // Form fields → validated; BroadcastError with a message for the console otherwise
  clean(fields) {
    fields = fields || {};
    var text = String(fields.text || '').replace(/\r\n/g, '\n').trim();
    if (!text) throw new BroadcastError('Нужен текст рассылки');
    var photoUrl = String(fields.photoUrl || '').trim() || null;
    if (photoUrl && !/^https:\/\/\S+$/.test(photoUrl)) throw new BroadcastError('Картинка — ссылка, начинается с https://');
    if (text.length > 4096) throw new BroadcastError('Текст длиннее, чем принимает Телеграм (4096 знаков)');
    var segment = String(fields.segment || '');
    if (!SEGMENTS[segment]) throw new BroadcastError('Выберите, кому отправить');
    var buttonText = String(fields.buttonText || '').trim() || null;
    var buttonUrl = String(fields.buttonUrl || '').trim() || null;
    if (!!buttonText !== !!buttonUrl) throw new BroadcastError('Для кнопки нужны и надпись, и ссылка');
    if (buttonUrl && !/^(https?:\/\/|tg:\/\/)\S+$/.test(buttonUrl)) throw new BroadcastError('Ссылка кнопки — https://… или tg://…');
    if (buttonText && buttonText.length > 64) throw new BroadcastError('Надпись на кнопке — до 64 знаков');
    return { text: text, photoUrl: photoUrl, segment: segment, buttonText: buttonText, buttonUrl: buttonUrl };
  }

  async create(fields, by) {
    var now = nowIso();
    var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    var doc = Object.assign({ id: id }, this.clean(fields), {
      status: 'draft', createdAt: now, createdBy: Number(by), updatedAt: now, testedAt: null,
    });
    await this.store.save(id, doc);
    return doc;
  }

  // Only drafts can be edited; after an edit, "Отправить себе" is needed again
  async update(id, fields) {
    var doc = await this.mustGet(id);
    if (doc.status !== 'draft') throw new BroadcastError('Запущенную рассылку не поправить');
    var next = Object.assign({}, doc, this.clean(fields), { updatedAt: nowIso(), testedAt: null });
    await this.store.save(id, next);
    return next;
  }

  // Who gets it: by segment, without those who blocked the bot
  async recipients(doc) {
    var match = doc.segment === 'photo'
      ? function(u) { return u.photoSubscribed === true; }
      : function() { return true; };
    var users = await this.store.users();
    return users
      .filter(function(u) { return !u.blocked && !u.botBlocked && match(u); })
      .map(function(u) { return Number(u.id); })
      .filter(function(id) { return id > 0; })
      .sort(function(a, b) { return a - b; });
  }

  async countRecipients(fields) {
    return (await this.recipients(fields)).length;
  }

  // One message to one person
  async deliver(chatId, doc, meta) {
    var markup = doc.buttonUrl ? { reply_markup: { inline_keyboard: [[{ text: doc.buttonText, url: doc.buttonUrl }]] } } : {};
    var text = doc.text;
    if (doc.photoUrl) {
      if (text.length <= CAPTION_LIMIT) {
        return this.tg.call('sendPhoto', Object.assign({ chat_id: chatId, photo: doc.photoUrl, caption: text, parse_mode: 'HTML' }, markup), { meta: meta });
      }
      await this.tg.call('sendPhoto', { chat_id: chatId, photo: doc.photoUrl }, { meta: meta });
    }
    return this.tg.call('sendMessage', Object.assign({ chat_id: chatId, text: text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } }, markup), { meta: meta });
  }

  // "Отправить себе": shows Telegram accepts the markup. Required before start
  async sendTest(id, admin) {
    var doc = await this.mustGet(id);
    try {
      await this.deliver(admin.id, doc, { by: 'admin', adminId: admin.id, adminName: admin.name || null, broadcast: id });
    } catch (err) {
      throw new BroadcastError('Телеграм не принял сообщение: ' + (err.description || err.message));
    }
    var next = Object.assign({}, doc, { testedAt: nowIso() });
    await this.store.save(id, next);
    return next;
  }

  async start(id, by) {
    var doc = await this.mustGet(id);
    if (doc.status !== 'draft') throw new BroadcastError('Рассылка уже запускалась');
    if (!doc.testedAt || doc.testedAt < doc.updatedAt) throw new BroadcastError('Сначала «Отправить себе» — после последней правки');
    var recipients = await this.recipients(doc);
    if (!recipients.length) throw new BroadcastError('Получателей нет');
    await this.store.save(id, Object.assign({}, doc, {
      status: 'running', recipients: recipients, cursor: 0,
      stats: { sent: 0, failed: 0, blocked: 0 }, errors: [],
      startedAt: nowIso(), startedBy: Number(by),
    }));
    delete this.wanted[id];
    this.kick();
    return recipients.length;
  }

  pause(id) { return this.setStatus(id, ['running'], 'paused', 'pausedAt'); }

  async resume(id) {
    var doc = await this.setStatus(id, ['paused'], 'running', 'resumedAt');
    this.kick();
    return doc;
  }

  cancel(id) { return this.setStatus(id, ['running', 'paused'], 'cancelled', 'cancelledAt'); }

  async setStatus(id, from, to, stamp) {
    var doc = await this.mustGet(id);
    var current = this.wanted[id] || doc.status;
    if (from.indexOf(current) === -1) throw new BroadcastError('Нельзя: рассылка ' + current);
    // The loop holds the freshest cursor/stats in memory: tell it, it saves on its next step.
    // If the loop isn't on this broadcast, write directly.
    var next = Object.assign({}, doc, { status: to }, { [stamp]: nowIso() });
    if (this.current === id && to !== 'running') {
      this.wanted[id] = to;
    } else {
      delete this.wanted[id];
      await this.store.save(id, next);
    }
    return next;
  }

  // On boot: continue whatever was running before the restart
  resumeAll() { return this.kick(); }

  // Background loop over running broadcasts, oldest first. Repeated calls don't start a 2nd loop
  kick() {
    var self = this;
    if (!this.running) {
      this.running = this.loop()
        .catch(function(err) { console.error('[broadcasts] background send stopped:', err.message); })
        .finally(function() { self.running = null; self.current = null; });
    }
    return this.running;
  }

  async loop() {
    for (;;) {
      var docs = await this.store.list();
      var next = docs
        .filter(function(d) { return d.status === 'running'; })
        .sort(function(a, b) { return String(a.startedAt).localeCompare(String(b.startedAt)); })[0];
      if (!next) return;
      await this.process(next);
    }
  }

  async process(doc) {
    var id = doc.id;
    this.current = id;
    var meta = { by: 'admin', adminId: doc.startedBy, broadcast: id };
    var unsaved = 0;
    var self = this;
    var save = function(extra) {
      unsaved = 0;
      return self.store.save(id, Object.assign({}, doc, extra || {}));
    };
    while (doc.cursor < doc.recipients.length) {
      var wanted = this.wanted[id];
      if (wanted && wanted !== 'running') {
        // Paused / cancelled from the console: persist progress with the new status and stop
        var stamp = wanted === 'paused' ? 'pausedAt' : 'cancelledAt';
        doc = Object.assign({}, doc, { status: wanted }, { [stamp]: nowIso() });
        delete this.wanted[id];
        await save();
        this.current = null;
        return;
      }
      var chatId = doc.recipients[doc.cursor];
      try {
        await this.deliver(chatId, doc, meta);
        doc = Object.assign({}, doc, { stats: Object.assign({}, doc.stats, { sent: doc.stats.sent + 1 }) });
      } catch (err) {
        if (err.code === 429) {
          // Telegram asks to wait — wait and retry the same person
          await this.sleep((err.retryAfter || 5) * 1000);
          continue;
        }
        if (err.code === 403) {
          await Promise.resolve(this.store.markBlocked(chatId)).catch(function() {});
          doc = Object.assign({}, doc, { stats: Object.assign({}, doc.stats, { blocked: doc.stats.blocked + 1 }) });
        } else {
          var errors = (doc.errors || []).concat([{ userId: chatId, error: err.description || err.message }]).slice(-5);
          doc = Object.assign({}, doc, { stats: Object.assign({}, doc.stats, { failed: doc.stats.failed + 1 }), errors: errors });
        }
      }
      doc = Object.assign({}, doc, { cursor: doc.cursor + 1 });
      if (++unsaved >= SAVE_EVERY) await save();
      await this.sleep(this.rateMs);
    }
    doc = Object.assign({}, doc, { status: 'done', finishedAt: nowIso() });
    delete this.wanted[id];
    await save();
    this.current = null;
    var s = doc.stats;
    this.log('Рассылка ' + id + ' готова: отправлено ' + s.sent + ', не дошло ' + s.failed + ', заблокировали бота ' + s.blocked);
  }
}

module.exports = { Broadcasts: Broadcasts, BroadcastError: BroadcastError, SEGMENTS: SEGMENTS };
