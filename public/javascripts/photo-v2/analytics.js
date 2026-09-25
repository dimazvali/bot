// GA4 events for photo.dimazvali.com. Loaded in <head> right after the gtag snippet, so every other
// script can just call window.photoTrack(name, params).
//
//  • the owner's own clicks are never counted (layout sets window.photoIsAdmin for a logged-in admin);
//  • events go out with transport_type 'beacon' — several of them fire right before a page reload
//    (send a mark, subscribe, unsubscribe), a normal request would be cancelled;
//  • redirect-based forms (photo inquiry, about-page contact/review) are counted on the page they land on,
//    i.e. only when the server confirmed the submit — see landing() below.
//
// Event catalogue (GA4 recommended names where one exists):
//   lightbox_open · instagram_click · contact_click · subscribe_click · subscribe · unsubscribe · generate_lead
//   submit_review · add_comment · login · add_point · share · shoot_selection_saved · shoot_download
//   instagram_download · filter_apply · presentation_start · map_open · promo_open · theme_change
//   language_switch · photo_navigate · instagram_card_dismiss · lightbox_caption_toggle · curator_show_all
(function () {
  var admin = !!window.photoIsAdmin;
  var lang = document.documentElement.lang === 'en' ? 'en' : 'ru';

  function track(name, params) {
    if (admin || typeof window.gtag !== 'function') return;
    var p = { page_path: location.pathname, site_lang: lang, transport_type: 'beacon' };
    if (params) Object.keys(params).forEach(function (k) {
      var v = params[k];
      if (v === undefined || v === null || v === '') return;
      p[k] = typeof v === 'string' ? v.slice(0, 100) : v; // GA4 truncates parameter values at 100 chars anyway
    });
    try { window.gtag('event', name, p); } catch (e) {}
  }

  // identifies the photo on the current photo page (works for portfolio photos and shoot photos)
  track.photo = function () {
    var title = document.querySelector('.photo-page-title');
    return {
      photo_id: location.pathname.split('/').filter(Boolean).pop(),
      photo_title: title ? title.textContent.trim() : '',
      in_shoot: /^\/(en\/)?shoot\//.test(location.pathname),
    };
  };

  window.photoTrack = track;

  // remember which inquiry type (print / licence / question) was picked — the form posts and redirects,
  // so the landing page no longer knows
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || !form.matches || !form.matches('form.inquiry-form[action$="/inquiry"]')) return;
    var checked = form.querySelector('input[name="type"]:checked');
    try { sessionStorage.setItem('photoInquiryType', checked ? checked.value : ''); } catch (err) {}
  }, true);

  // success landings: ?inquiry=ok · ?sent=contact · ?sent=review. The parameter is stripped afterwards so a
  // reload or a shared URL doesn't count the same submit twice.
  function landing() {
    var q = new URLSearchParams(location.search);
    var done = false;
    if (q.get('inquiry') === 'ok') {
      var type = '';
      try { type = sessionStorage.getItem('photoInquiryType') || ''; sessionStorage.removeItem('photoInquiryType'); } catch (e) {}
      track('generate_lead', Object.assign({ form: 'photo_inquiry', inquiry_type: type }, track.photo()));
      q.delete('inquiry'); done = true;
    }
    if (q.get('sent') === 'contact') { track('generate_lead', { form: 'contact' }); q.delete('sent'); done = true; }
    else if (q.get('sent') === 'review') { track('submit_review'); q.delete('sent'); done = true; }
    if (done && window.history && history.replaceState) {
      var qs = q.toString();
      history.replaceState(history.state, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', landing);
  else landing();
}());
