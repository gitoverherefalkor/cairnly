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

// Only the live site configures the tag. The same bundle is served by dev
// servers, Vercel branch deploys and Lovable's per-commit previews, and an
// unguarded config call makes the tag report from those hosts too — which is
// how five *.lovable.app domains ended up in Google's cross-domain
// suggestions. Without a destination configured, gtag.js loads but sends
// nothing, so conversions can only ever come from real traffic.
// Mirrors PRODUCTION_HOST in src/lib/analytics.ts, which already does this
// for the first-party beacons.
if (window.location.hostname.endsWith('cairnly.io')) {
  gtag('js', new Date());
  gtag('config', 'AW-11471365050');
}
