import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { Globe, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

// LanguageSuggestionBanner — one-time offer to switch to a localized version
// of the site when the visitor's browser is set to a language we support.
//
// Why an OFFER and not an automatic switch: i18n.ts deliberately does NOT
// include 'navigator' in its detection order, because auto-detecting the
// browser language used to force the whole UI into Dutch for people who want
// English (e.g. expats living in NL). So the browser language is read HERE
// only to decide whether to *ask*. The actual language authority stays exactly
// as it is: an explicit choice (flag switcher / this banner) or a .nl domain.
//
// Adding a language later: add one entry to SUGGESTIONS. No other changes.

const DISMISSED_KEY = 'cairnly_language_suggestion_dismissed';
/** Set by i18next (lookupLocalStorage in i18n.ts) once a language is chosen. */
const LANGUAGE_CHOICE_KEY = 'cairnly_language';

interface Suggestion {
  /** Copy is written in the TARGET language: it is aimed at speakers of it. */
  message: string;
  accept: string;
  decline: string;
}

const SUGGESTIONS: Record<string, Suggestion> = {
  nl: {
    message: 'Liever verder in het Nederlands? We hebben een Nederlandse versie.',
    accept: 'Ja, ga naar Nederlands',
    decline: 'Continue in English',
  },
};

/** 'nl-NL' -> 'nl'. Returns the first browser language we have an offer for. */
function detectOfferableLanguage(current: string): string | null {
  const prefs: string[] = [
    ...(navigator.languages ?? []),
    navigator.language,
  ].filter(Boolean);

  for (const raw of prefs) {
    const base = raw.split('-')[0].toLowerCase();
    // Already reading the site in that language: nothing to offer.
    if (base === current.split('-')[0].toLowerCase()) return null;
    if (SUGGESTIONS[base]) return base;
  }
  return null;
}

const LanguageSuggestionBanner = () => {
  const { i18n } = useTranslation();
  const { pathname } = useLocation();
  const [offer, setOffer] = useState<string | null>(null);

  useEffect(() => {
    try {
      // Already asked once, or the visitor has already made an explicit
      // language choice (flag switcher / previous visit): never ask again.
      if (localStorage.getItem(DISMISSED_KEY)) return;
      if (localStorage.getItem(LANGUAGE_CHOICE_KEY)) return;
    } catch {
      // Storage blocked: skip the banner entirely rather than risk nagging
      // on every single page load with no way to remember the dismissal.
      return;
    }

    const detected = detectOfferableLanguage(i18n.language || 'en');
    if (!detected) return;

    // Small delay so it doesn't flash during first paint (same as the
    // cookie banner).
    const timer = setTimeout(() => setOffer(detected), 800);
    return () => clearTimeout(timer);
  }, [i18n.language]);

  // Never interrupt an active chat session: switching language mid-chat would
  // leave a half-Dutch, half-English transcript. Same rule as LanguageSwitcher.
  if (pathname.startsWith('/chat')) return null;
  if (!offer) return null;

  const copy = SUGGESTIONS[offer];

  const remember = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, new Date().toISOString());
    } catch {
      // Best effort only.
    }
    setOffer(null);
  };

  const handleAccept = () => {
    // changeLanguage also persists to the user's profile when logged in (see
    // useLanguage), so their emails and dashboard follow the same choice.
    i18n.changeLanguage(offer);
    remember();
  };

  return (
    <div
      className="relative z-50 border-b"
      style={{ background: '#FDFBF2', borderColor: 'rgba(201,182,144,0.6)' }}
      role="region"
      aria-label={copy.message}
    >
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-3 px-4 py-3">
        <p className="flex-1 flex items-center gap-2 text-sm text-[#1F2937]">
          <Globe className="h-4 w-4 shrink-0 text-atlas-teal" />
          {copy.message}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            className="bg-atlas-teal hover:bg-atlas-teal/90 text-white"
            onClick={handleAccept}
          >
            {copy.accept}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-[#4B6373] hover:text-[#122E3B]"
            onClick={remember}
          >
            {copy.decline}
          </Button>
          <button
            type="button"
            onClick={remember}
            aria-label={copy.decline}
            className="p-1 text-[#6B7F8B] transition-colors hover:text-[#122E3B]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default LanguageSuggestionBanner;
