// Google Ads (gtag.js) bootstrap. Loaded as an external script, alongside the
// async googletagmanager.com <script src>, to comply with the strict CSP (no
// 'unsafe-inline' for script-src) — see index.html and vercel.json.
window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }

// Consent Mode v2: ad signals default to denied. Google then measures
// conversions in a privacy-preserving, cookieless (modeled) way instead of
// setting ad cookies, until CookieConsentBanner.tsx calls
// gtag('consent', 'update', ...) on "Accept All". A returning visitor's past
// choice is read here — synchronously, before gtag.js loads — so a repeat
// visitor who already opted in isn't treated as "denied" on every page.
// KEEP IN SYNC: the storage key and { choice, timestamp } shape are owned by
// CookieConsentBanner.tsx's COOKIE_CONSENT_KEY.
(function () {
  var granted = false;
  try {
    var stored = JSON.parse(localStorage.getItem('cairnly-cookie-consent') || 'null');
    granted = !!stored && stored.choice === 'all';
  } catch (e) {
    // Malformed/blocked storage — fall through to the safe default (denied).
  }
  var state = granted ? 'granted' : 'denied';
  gtag('consent', 'default', {
    ad_storage: state,
    ad_user_data: state,
    ad_personalization: state,
    analytics_storage: state,
  });
})();

gtag('js', new Date());
gtag('config', 'AW-11471365050');
