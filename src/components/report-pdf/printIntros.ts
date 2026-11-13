// Section intros and chapter framing for the PRINTED report.
//
// ── Why this is not just an import of boilerplate.ts ────────────────────────
//
// The chat's intros live in `supabase/functions/deliver-section/boilerplate.ts`
// and they are the substance these are derived from. They are not reused
// verbatim, for three reasons:
//
//   1. They are written for a conversation. `approach` opens with "Hi there.
//      Let's dive into your personality profile", and several close by asking
//      the reader to reply. In a document that reads as a pasted transcript.
//   2. `top_career_2` and `top_career_3` have `intro: null` on purpose — in
//      chat they continue from the previous turn. On paper they are section
//      headings with nothing under them, so they need real intros.
//   3. `top_career_1`'s intro embeds a literal "## CHAPTER 2: CAREER
//      RECOMMENDATIONS" markdown heading, which the print layout expresses as
//      a chapter divider instead.
//
// It is also a runtime boundary: that file is Deno, this bundle is the
// browser's. Importing across it would drag Deno-isms into the SPA.
//
// KEEP IN SYNC BY MEANING, NOT BY STRING. If you change what a section covers
// in boilerplate.ts, change it here too.
//
// Dutch follows the same glossary rules as the rest of the NL work: je-form,
// no em-dashes, brand terms kept in English (Cairnly, runner-up,
// outside-the-box).

export type PrintSectionType =
  | 'exec_summary'
  | 'approach'
  | 'personality_team'
  | 'strengths'
  | 'development'
  | 'values'
  | 'top_career_1'
  | 'top_career_2'
  | 'top_career_3'
  | 'runner_ups'
  | 'outside_box'
  | 'dream_jobs'
  // Written by WF6 from the coach conversation. Not in SECTION_ORDER, so it is
  // appended after the career chapter — which is where it belongs anyway.
  | 'chat_highlights';

export type PrintLang = 'en' | 'nl';

const EN: Partial<Record<PrintSectionType, string>> = {
  exec_summary:
    'The short version of everything that follows: what your profile points to, which roles came out on top, and the first move worth making.',
  approach:
    'How you navigate challenges, lead teams and engage with the people around you, and what that means for the environments where you do your best work.',
  personality_team:
    'How you navigate challenges, lead teams and engage with the people around you, and what that means for the environments where you do your best work.',
  strengths: 'What sets you apart professionally, and how to put more weight on it.',
  development:
    'The areas where focused effort makes the biggest difference to the goals you named. Not weaknesses, but the things currently costing you the most.',
  values:
    'What matters most to you in your work, and how that shapes which roles will actually fit rather than merely look good.',
  top_career_1:
    'Your strongest match, based on your personality, values and skills. What the work involves, why it fits, and what to be honest with yourself about.',
  top_career_2:
    'Your second match. Close to the first in overall fit, but different in focus, environment or trajectory.',
  top_career_3:
    'Your third match, and the last of the top three. Worth reading even if the first two landed better, since it often isolates what you actually want.',
  runner_ups:
    'Close alternatives to your top three. Also strong fits for your strengths and values, but differing in focus, work environment or trajectory. A comparison set rather than the creative picks.',
  outside_box:
    'Sometimes the best paths are not the obvious ones. These roles fit who you are but probably were not on your radar.',
  dream_jobs:
    'You told us your dream job without worrying about constraints, and that was deliberate. Here we put the constraints back in: not to talk you out of it, but to show what getting there would really take, and what a version of it might look like that fits the experience you already have.',
  chat_highlights:
    'What came out of talking it through with your coach. These are the points where something shifted: a pattern you named, a correction you made, or a conclusion the two of you reached together. Your own words shaped the report you have just read.',
};

const NL: Partial<Record<PrintSectionType, string>> = {
  exec_summary:
    'De korte versie van alles wat volgt: waar je profiel op wijst, welke rollen bovenaan eindigden, en de eerste stap die de moeite waard is.',
  approach:
    'Hoe je uitdagingen aanpakt, teams leidt en met de mensen om je heen omgaat, en wat dat betekent voor de omgevingen waarin je je beste werk levert.',
  personality_team:
    'Hoe je uitdagingen aanpakt, teams leidt en met de mensen om je heen omgaat, en wat dat betekent voor de omgevingen waarin je je beste werk levert.',
  strengths: 'Wat je professioneel onderscheidt, en hoe je daar meer gewicht op legt.',
  development:
    'De gebieden waar gerichte inzet het grootste verschil maakt voor de doelen die je noemde. Geen zwaktes, maar de dingen die je nu het meeste kosten.',
  values:
    'Wat voor jou het belangrijkst is in je werk, en hoe dat bepaalt welke rollen echt passen in plaats van alleen goed klinken.',
  top_career_1:
    'Je sterkste match, gebaseerd op je persoonlijkheid, waarden en vaardigheden. Wat het werk inhoudt, waarom het past, en waar je eerlijk over moet zijn tegen jezelf.',
  top_career_2:
    'Je tweede match. Qua fit dicht bij de eerste, maar met een andere focus, werkomgeving of loopbaantraject.',
  top_career_3:
    'Je derde match, en de laatste van de top drie. Ook waardevol als de eerste twee beter landden, omdat deze vaak scherp maakt wat je écht wilt.',
  runner_ups:
    'Alternatieven die dicht bij je top drie liggen. Ook sterke matches met je sterke punten en waarden, maar met een andere focus, werkomgeving of loopbaantraject. Een vergelijking, niet de creatieve keuzes.',
  outside_box:
    'Soms zijn de beste paden niet de meest voor de hand liggende. Deze rollen passen bij wie je bent, maar stonden waarschijnlijk niet op je radar.',
  dream_jobs:
    'Je vertelde ons je droombaan zonder rekening te houden met beperkingen, en dat was bewust. Hier halen we die beperkingen erbij: niet om je iets uit het hoofd te praten, maar om te laten zien wat het echt zou kosten om er te komen, en hoe een versie ervan eruit kan zien die aansluit bij de ervaring die je al hebt.',
  chat_highlights:
    'Wat er uit het gesprek met je coach kwam. Dit zijn de momenten waarop er iets verschoof: een patroon dat je benoemde, een correctie die je maakte, of een conclusie die jullie samen trokken. Jouw eigen woorden hebben het rapport gevormd dat je zojuist hebt gelezen.',
};

const INTROS: Record<PrintLang, Partial<Record<PrintSectionType, string>>> = { en: EN, nl: NL };

// Encore: directions for the next stage, "your idea" instead of a dream job,
// and formal Dutch ("u").
const ENCORE_INTROS: Record<PrintLang, Partial<Record<PrintSectionType, string>>> = {
  en: {
    exec_summary:
      'The short version of everything that follows: what your profile points to, which directions came out on top, and a first step worth taking.',
    approach:
      'How you work best now: where your energy comes from, what people count on you for, and the kind of setting that suits this stage.',
    personality_team:
      'How you work best now: where your energy comes from, what people count on you for, and the kind of setting that suits this stage.',
    strengths: 'What you bring from your working life, and which of it carries over to what comes next.',
    development:
      'What to watch for: old habits that may not fit a new setting, and what that means for your choices.',
    values: 'What matters to you now, and how that shapes which directions will actually feel right.',
    top_career_1:
      'Your strongest direction, based on your profile, your values and what you want from this stage. What it involves, why it fits, and what to be honest with yourself about.',
    top_career_2: 'Your second direction. Close to the first in fit, but different in kind, setting or rhythm.',
    top_career_3:
      'Your third direction, and the last of the top three. Worth reading even if the first two landed better, since it often makes clear what you really want.',
    runner_ups:
      'Other directions that suit you well but came in just behind the top three. A comparison set, not the surprising picks.',
    outside_box:
      'Sometimes the best paths are not the obvious ones. These directions fit who you are but were probably not on your radar.',
    dream_jobs:
      'You told us about an idea you keep coming back to. Here we look at it honestly: what it would really take, and what a version of it could look like that fits the experience you already have.',
    chat_highlights:
      'What came out of talking it through with your coach: a pattern you named, a correction you made, or a conclusion you reached together. Your own words shaped the report you have just read.',
  },
  nl: {
    exec_summary:
      'De korte versie van alles wat volgt: waar uw profiel op wijst, welke richtingen bovenaan eindigden, en een eerste stap die de moeite waard is.',
    approach:
      'Hoe u nu het beste werkt: waar uw energie vandaan komt, waar mensen op u rekenen, en welke omgeving bij deze fase past.',
    personality_team:
      'Hoe u nu het beste werkt: waar uw energie vandaan komt, waar mensen op u rekenen, en welke omgeving bij deze fase past.',
    strengths: 'Wat u meebrengt uit uw werkzame leven, en wat daarvan meegaat naar wat hierna komt.',
    development:
      'Waar u op moet letten: oude gewoonten die niet altijd passen in een nieuwe omgeving, en wat dat betekent voor uw keuzes.',
    values: 'Wat nu voor u telt, en hoe dat bepaalt welke richtingen echt goed zullen voelen.',
    top_career_1:
      'Uw sterkste richting, gebaseerd op uw profiel, uw waarden en wat u van deze fase wilt. Wat het inhoudt, waarom het past, en waar u eerlijk over moet zijn tegenover uzelf.',
    top_career_2: 'Uw tweede richting. Qua aansluiting dicht bij de eerste, maar anders van aard, omgeving of ritme.',
    top_career_3:
      'Uw derde richting, en de laatste van de top drie. Ook de moeite waard als de eerste twee beter landden, omdat deze vaak duidelijk maakt wat u echt wilt.',
    runner_ups:
      'Andere richtingen die goed bij u passen, maar net achter de top drie eindigden. Een vergelijking, niet de verrassende keuzes.',
    outside_box:
      'Soms zijn de beste paden niet de meest voor de hand liggende. Deze richtingen passen bij wie u bent, maar stonden waarschijnlijk niet op uw radar.',
    dream_jobs:
      'U vertelde ons over een idee waar u steeds op terugkomt. Hier bekijken we het eerlijk: wat het echt zou vragen, en hoe een versie ervan eruit kan zien die aansluit bij de ervaring die u al heeft.',
    chat_highlights:
      'Wat er uit het gesprek met uw coach kwam: een patroon dat u benoemde, een correctie die u maakte, of een conclusie die u samen trok. Uw eigen woorden hebben het rapport gevormd dat u zojuist heeft gelezen.',
  },
};

export function introFor(sectionType: string, lang: PrintLang, encore = false): string | null {
  const t = sectionType as PrintSectionType;
  return (encore ? ENCORE_INTROS[lang][t] : undefined) ?? INTROS[lang][t] ?? null;
}

// ── Chapters ────────────────────────────────────────────────────────────────
// The chat splits the report into two chapters and announces them inline
// ("## CHAPTER 2: CAREER RECOMMENDATIONS"). Print expresses the same split as
// a divider ahead of the first section of each chapter.

export type Chapter = 'about-you' | 'careers';

/** Which chapter a section belongs to. Mirrors the `chapter` field on
 *  ALL_SECTIONS in the chat sidebar, so the printed document, the sidebar and
 *  the contents page cannot drift apart. */
export function chapterFor(sectionType: string): Chapter {
  return sectionType.startsWith('top_career') ||
    sectionType === 'runner_ups' ||
    sectionType === 'outside_box' ||
    sectionType === 'dream_jobs'
    ? 'careers'
    : 'about-you';
}

export const CHAPTERS: Record<PrintLang, Record<Chapter, { kicker: string; title: string; blurb: string }>> = {
  en: {
    'about-you': {
      kicker: 'Chapter one',
      title: 'About you',
      blurb:
        'Your working profile: how you operate, what you are good at, where the friction is, and what you actually value. Everything in the second half is built on this.',
    },
    careers: {
      kicker: 'Chapter two',
      title: 'Career recommendations',
      blurb:
        'Roles matched against the profile in chapter one. Your top three first, then close alternatives, then the unexpected directions and a reality check on your dream job.',
    },
  },
  nl: {
    'about-you': {
      kicker: 'Hoofdstuk een',
      title: 'Over jou',
      blurb:
        'Je werkprofiel: hoe je te werk gaat, waar je goed in bent, waar de wrijving zit, en wat je echt belangrijk vindt. Alles in de tweede helft bouwt hierop voort.',
    },
    careers: {
      kicker: 'Hoofdstuk twee',
      title: 'Loopbaanaanbevelingen',
      blurb:
        'Rollen afgezet tegen het profiel uit hoofdstuk een. Eerst je top drie, dan alternatieven die dichtbij liggen, en tot slot de onverwachte richtingen en een realiteitscheck op je droombaan.',
    },
  },
};

const ENCORE_CHAPTERS: Record<PrintLang, Record<Chapter, { kicker: string; title: string; blurb: string }>> = {
  en: {
    'about-you': {
      kicker: 'Chapter one',
      title: 'About you',
      blurb:
        'Your profile now: how you work best, what you bring, what to watch for, and what matters to you at this stage. Everything in the second half is built on this.',
    },
    careers: {
      kicker: 'Chapter two',
      title: 'Directions for what comes next',
      blurb:
        'Directions matched against the profile in chapter one. Your top three first, then other good fits, then the surprising options and, if you shared one, an honest look at your own idea.',
    },
  },
  nl: {
    'about-you': {
      kicker: 'Hoofdstuk een',
      title: 'Over u',
      blurb:
        'Uw profiel nu: hoe u het beste werkt, wat u meebrengt, waar u op moet letten en wat in deze fase voor u telt. Alles in de tweede helft bouwt hierop voort.',
    },
    careers: {
      kicker: 'Hoofdstuk twee',
      title: 'Richtingen voor wat hierna komt',
      blurb:
        'Richtingen afgezet tegen het profiel uit hoofdstuk een. Eerst uw top drie, dan andere goede opties, dan de verrassende richtingen en, als u er een noemde, een eerlijke blik op uw eigen idee.',
    },
  },
};

export function chapterCopy(lang: PrintLang, chapter: Chapter, encore = false) {
  return (encore ? ENCORE_CHAPTERS : CHAPTERS)[lang][chapter];
}

// ── Share-quote framing ─────────────────────────────────────────────────────
// The pull quote is lifted from the LinkedIn share-card feature, so the line
// under it points the reader back at that feature. It is deliberately phrased
// so it still makes sense on paper, where the link cannot be clicked.
export const SHARE_PROMPT: Record<PrintLang, { label: string; cta: string }> = {
  en: {
    label: 'From your report',
    cta: 'Want to share this? Pick a different line and get a ready-made card at',
  },
  nl: {
    label: 'Uit je rapport',
    cta: 'Wil je dit delen? Kies een andere regel en maak een kant-en-klare kaart op',
  },
};

/** Encore Dutch speaks "u"; English and Pro use SHARE_PROMPT as is. */
export function sharePromptFor(lang: PrintLang, encore = false): { label: string; cta: string } {
  if (encore && lang === 'nl') {
    return {
      label: 'Uit uw rapport',
      cta: 'Wilt u dit delen? Kies een andere regel en maak een kant-en-klare kaart op',
    };
  }
  return SHARE_PROMPT[lang];
}
