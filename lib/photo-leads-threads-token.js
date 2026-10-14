'use strict';
var axios = require('axios');

var META = 'photo_leads_meta';
var DOC = 'threads';
var REFRESH_AFTER_MS = 7 * 24 * 3600 * 1000;

// Long-lived Threads user token (valid 60 days). Seeded from THREADS_ACCESS_TOKEN,
// then kept in Firestore and refreshed weekly. Set the env var only after Meta
// approves threads_keyword_search — before that the API searches only the token
// owner's own posts, so with no token the threads collector uses Apify instead.
var _db = null;
function init(db) { _db = db; }

// deps (tests): { get(url, opts) → {data}, now() }
async function get(deps) {
  deps = deps || {};
  var env = process.env.THREADS_ACCESS_TOKEN || null;
  if (!_db) return env;
  var http = deps.get || axios.get;
  var now = (deps.now || Date.now)();
  var ref = _db.collection(META).doc(DOC);
  var cur = (await ref.get()).data() || null;

  // A new env value (first deploy, or a manually re-issued token) wins over the stored one.
  if (env && (!cur || cur.fromEnv !== env)) {
    cur = { accessToken: env, fromEnv: env, refreshedAt: now };
    await ref.set(cur);
  }
  if (!cur || !cur.accessToken) return null;

  if (now - (cur.refreshedAt || 0) > REFRESH_AFTER_MS) {
    try {
      var res = await http('https://graph.threads.net/refresh_access_token', {
        params: { grant_type: 'th_refresh_token', access_token: cur.accessToken }, timeout: 15000,
      });
      cur = Object.assign({}, cur, { accessToken: res.data.access_token, refreshedAt: now });
      await ref.set(cur);
    } catch (e) {
      // The old token stays valid until it expires; an expired one surfaces as a source error in the digest.
      console.error('[photo-leads] threads token refresh', e.message);
    }
  }
  return cur.accessToken;
}

module.exports = { init: init, get: get };
