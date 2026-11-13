// Boilerplate intros and outros for each section delivery, per language.
// Lifted verbatim from the WF5.2 Atlas Agent system prompt (BOILERPLATE QUICK
// REFERENCE) for English. Dutch entries follow the same shape and tone, written
// per LOCALIZATION_PLAN.md glossary rules (je-form, no em-dashes, brand terms
// preserved in English: Cairnly, runner-up, outside-the-box).
//
// `intro: null`  → no intro line (top_career_2/3 continue from previous turn)
// `outro: null`  → no outro line (dream_jobs waits silently after delivery)
//
// To add a language: copy the EN block, translate respecting glossary rules,
// add the language code to `Language` and to `BOILERPLATE`. Default fallback
// is always 'en'.

export type SectionType =
  | 'approach'
  | 'strengths'
  | 'development'
  | 'values'
  | 'top_career_1'
  | 'top_career_2'
  | 'top_career_3'
  | 'runner_ups'
  | 'outside_box'
  | 'dream_jobs';

export type Language = 'en' | 'nl';

interface Boilerplate {
  intro: string | null;
  outro: string | null;
}

const EN: Record<SectionType, Boilerplate> = {
  approach: {
    intro:
      "Hi there. Let's dive into your personality profile. We'll start with your work approach - how you navigate challenges, lead teams, and engage with others.",
    outro:
      "**Does this feel like an accurate reflection of your work style?** Let me know if anything stands out or if you'd like to refine any part.",
  },
  strengths: {
    intro:
      "Let's talk about your strengths - what sets you apart professionally and drives your success.",
    outro:
      "**Do these insights align with how you see yourself professionally?** If there's anything you'd like to adjust or highlight further, let me know.",
  },
  development: {
    intro:
      'Now for the growth opportunities - areas where focused development can make the biggest difference in reaching your goals.',
    outro:
      "**Do these observations and suggestions resonate with you?** Let me know if there's anything you'd like to explore in more detail.",
  },
  values: {
    intro:
      "Finally, let's look at your core values - what matters most to you in your career and how that shapes the right fit.",
    outro:
      "**Does this section reflect what matters most to you?** If everything looks good, we can move on to your career recommendations. Let me know how you'd like to proceed.",
  },
  top_career_1: {
    intro:
      "## CHAPTER 2: CAREER RECOMMENDATIONS\n\nOk! Let's continue with our career recommendations and discuss why we think they are a great fit for you. We start with your top career matches first.\n\nBased on your personality, values, and skills, one of the most suitable jobs for you is:",
    outro:
      'That was your first top career match.\n\nBased on what we just covered, **does this role appeal to you? Does it align with your career goals and interests?**\n\nWere you expecting to see this as a top recommendation, or was it a surprise?\n\nIf you\'d like, I can provide more details, whether that\'s diving into the daily responsibilities, potential career paths, or industry trends. Or, if you\'re ready, we can move on to the next career match. **Let me know how you\'d like to proceed!**',
  },
  top_career_2: {
    intro: null,
    outro:
      'Alright, that was your second career match. **How does this one compare to the first? Do you see yourself thriving in this type of role?**\n\nWas this something you had considered before, or does it bring a new perspective on potential career paths for you?\n\nI\'m happy to go deeper into any aspects of this job e.g. compensation, long-term growth, or how it fits with your skills. Or, if you\'d prefer, we can move on to the next suggestion. **What do you think?**',
  },
  top_career_3: {
    intro: null,
    outro:
      "And that was your third top career match. **What's your first reaction? Does this feel like a strong fit**, or is it less aligned with what you had in mind?\n\nDo any aspects of this role stand out as particularly exciting or unexpected?\n\nIf you're curious about any specific details, I can expand on them. Or, if you're ready, we can move forward to your runner-up careers for a quick comparison. **Let me know how you'd like to continue!**",
  },
  runner_ups: {
    intro:
      "Let's take a look at your **runner-up career matches**. These are close alternatives to your top three: also strong fits for your strengths and values, but differing in focus, work environment, or trajectory. Think of them as a quick comparison set, not the creative picks. After this, we'll get to the genuinely unexpected directions: your **outside-the-box** options and your **dream jobs**. Here are the alternatives worth considering:",
    outro:
      'That wraps up your runner-up career matches! **Do you have any questions about any of these roles**, or anything else you\'d like to explore further?',
  },
  outside_box: {
    intro:
      "**Sometimes the best career paths aren't the most obvious ones.** Based on your personality, interests, and values, we've identified a few **outside-the-box career options.** Roles that align with who you are but might not have been on your radar. These could open up unexpected yet highly fulfilling opportunities. Let's take a look:",
    outro:
      "**Do any of these roles resonate with you?** Even if they're outside your usual scope, they might offer new ways to apply your strengths and interests in a way that feels exciting and rewarding. **Let me know your thoughts** whether you'd like more details on any of these or if you'd prefer to explore other directions. If not, we could move on to a bonus segment, the feasibility of your 'dream jobs'!",
  },
  dream_jobs: {
    intro:
      // The survey asks for a dream job "regardless of any constraining
      // factors", then this section rates its feasibility, including
      // credential barriers. Users have (fairly) called that contradictory.
      // The intro now names the switch explicitly so the honest read lands as
      // "here's the route" rather than "you gave the wrong answer".
      "We asked for your dream job without worrying about constraints, and that was on purpose. This section is where we put the constraints back in: not to talk you out of anything, but to show what it would realistically take to get there, and what a version of it might look like that fits the experience you already have. Let's break it down.",
    // No outro on initial delivery. The wrap-up message is sent separately
    // when the user clicks "All done, wrap up session".
    outro: null,
  },
};

const NL: Record<SectionType, Boilerplate> = {
  approach: {
    intro:
      "Hoi! Laten we eens in je persoonlijkheidsprofiel duiken. We starten met je werkbenadering: hoe je uitdagingen aanpakt, teams leidt en met anderen omgaat.",
    outro:
      "**Voelt dit als een juiste weergave van je werkstijl?** Laat het weten als iets opvalt of als je iets wilt verfijnen.",
  },
  strengths: {
    intro:
      "Laten we het hebben over je sterke punten: wat je professioneel onderscheidt en je succes drijft.",
    outro:
      "**Sluiten deze inzichten aan bij hoe je jezelf professioneel ziet?** Als je iets wilt aanpassen of verder wilt uitlichten, laat het weten.",
  },
  development: {
    intro:
      "Nu de groeikansen: gebieden waar gerichte ontwikkeling het grootste verschil maakt in het bereiken van je doelen.",
    outro:
      "**Klinken deze observaties en suggesties bekend?** Laat weten als er iets is dat je dieper wilt verkennen.",
  },
  values: {
    intro:
      "Tot slot kijken we naar je kernwaarden: wat voor jou het belangrijkst is in je loopbaan, en hoe dat de juiste fit bepaalt.",
    outro:
      "**Weerspiegelt dit onderdeel wat voor jou het belangrijkst is?** Als alles klopt, gaan we door naar je loopbaanaanbevelingen. Laat weten hoe je verder wilt.",
  },
  top_career_1: {
    intro:
      "## HOOFDSTUK 2: LOOPBAANAANBEVELINGEN\n\nOké! Laten we doorgaan met je loopbaanaanbevelingen en bespreken waarom we denken dat ze goed bij je passen. We starten met je beste matches.\n\nGebaseerd op je persoonlijkheid, waarden en vaardigheden is een van de meest geschikte banen voor jou:",
    outro:
      "Dat was je eerste topmatch.\n\nGebaseerd op wat we net besproken hebben, **spreekt deze rol je aan? Sluit hij aan bij je loopbaandoelen en interesses?**\n\nVerwachtte je deze als topaanbeveling, of was het een verrassing?\n\nAls je wilt, kan ik meer details geven, of dat nu de dagelijkse verantwoordelijkheden zijn, mogelijke loopbaanpaden, of trends in de sector. Of, als je er klaar voor bent, gaan we door naar de volgende match. **Laat weten hoe je verder wilt!**",
  },
  top_career_2: {
    intro: null,
    outro:
      "Oké, dat was je tweede match. **Hoe verhoudt deze zich tot de eerste? Zie je jezelf opbloeien in zo'n soort rol?**\n\nHad je deze al overwogen, of brengt hij een nieuw perspectief op mogelijke loopbaanpaden?\n\nIk ga graag dieper in op elk aspect van deze baan, bijvoorbeeld salaris, groei op de lange termijn, of hoe de baan aansluit bij je vaardigheden. Of, als je liever doorgaat, kunnen we naar de volgende suggestie. **Wat denk je?**",
  },
  top_career_3: {
    intro: null,
    outro:
      "En dat was je derde topmatch. **Wat is je eerste reactie? Voelt dit als een sterke fit**, of past het minder bij wat je in gedachten had?\n\nZijn er aspecten van deze rol die er bijzonder spannend of onverwacht uitspringen?\n\nAls je nieuwsgierig bent naar specifieke details, kan ik die toelichten. Of, als je er klaar voor bent, gaan we door naar je runner-up loopbanen voor een korte vergelijking. **Laat weten hoe je verder wilt!**",
  },
  runner_ups: {
    intro:
      "Laten we kijken naar je **runner-up matches**. Dit zijn alternatieven die dicht bij je top drie liggen: ook sterke matches met je sterke punten en waarden, maar met een andere focus, werkomgeving of loopbaantraject. Zie ze als een snelle vergelijking, niet de creatieve keuzes. Daarna komt het echt onverwachte deel: je **outside-the-box** opties en je **droombanen**. Hier zijn de alternatieven om te overwegen:",
    outro:
      "Daarmee zijn we klaar met je runner-up matches! **Heb je vragen over een van deze rollen**, of is er iets anders dat je verder wilt verkennen?",
  },
  outside_box: {
    intro:
      "**Soms zijn de beste loopbaanpaden niet de meest voor de hand liggende.** Gebaseerd op je persoonlijkheid, interesses en waarden hebben we een paar **outside-the-box loopbaanopties** geïdentificeerd. Rollen die passen bij wie je bent, maar misschien nog niet op je radar stonden. Deze kunnen onverwachte maar zeer bevredigende kansen openen. Laten we kijken:",
    outro:
      "**Spreekt een van deze rollen je aan?** Ook als ze buiten je gebruikelijke domein vallen, kunnen ze nieuwe manieren bieden om je sterke punten en interesses in te zetten op een manier die spannend en lonend voelt. **Laat je gedachten weten**: wil je meer details over een van deze rollen, of liever andere richtingen verkennen? Zo niet, dan kunnen we door naar een bonussegment: de haalbaarheid van je 'droombanen'!",
  },
  dream_jobs: {
    intro:
      "We vroegen naar je droombaan zonder rekening te houden met beperkingen, en dat was bewust. In dit onderdeel halen we die beperkingen er weer bij: niet om je iets uit het hoofd te praten, maar om te laten zien wat er realistisch voor nodig is om er te komen, en hoe een versie ervan eruit kan zien die aansluit bij de ervaring die je al hebt. Laten we het uitsplitsen.",
    outro: null,
  },
};

// Encore (older professionals, post-career direction). Its own voice: no
// "lead teams" or "career success", the career chapter is about directions
// (paid, freelance, volunteer), and Dutch says "u" (Sjoerd's rule for Encore).
// Encore's dream_jobs section is "Your idea": the survey asks (optional Q3.5)
// for something the person already tried or keeps coming back to, NOT for a
// dream job without constraints, so the Pro intro would be untrue here.
// The outside_box outro has a second form for people with no idea in Q3.5:
// they have no idea section, so the outro points to wrapping up instead.
const ENCORE_EN: Record<SectionType, Boilerplate> = {
  approach: {
    intro:
      "Let's start with you. First, how you work best at this point in your life: where your energy goes, and what you'd rather leave behind.",
    outro:
      '**Does this feel like you?** Tell me if anything is off or missing, and I\'ll take it into your report.',
  },
  strengths: {
    intro: "Next, what you bring: the qualities that keep coming back in your answers and your experience.",
    outro:
      "**Do you recognise yourself in this?** If you'd put something differently, just say so.",
  },
  development: {
    intro: "Now a few things to watch for: habits and pitfalls worth knowing about before you start something new.",
    outro: "**Does this ring true?** Tell me if you see it differently or want to talk about any point.",
  },
  values: {
    intro: "Last in this part: what matters to you now, and what that means for the kind of activity that fits.",
    outro:
      "**Does this capture what matters to you?** If it does, we'll move on to the directions that suit you. Let me know how you'd like to continue.",
  },
  top_career_1: {
    intro:
      "## CHAPTER 2: DIRECTIONS FOR YOU\n\nNow for the directions we think suit you, and why. We start with your top three.\n\nBased on your answers, your experience and what you're looking for, the direction that fits you best is:",
    outro:
      "That was your first direction.\n\n**Does this appeal to you? Is it the kind of thing you could see yourself doing?**\n\nDid you expect this one, or is it a surprise?\n\nI can tell you more about what it looks like in practice, or how people get started. Or we can move on to the next direction. **How would you like to continue?**",
  },
  top_career_2: {
    intro: null,
    outro:
      "That was your second direction. **How does it compare to the first? Can you picture yourself doing this?**\n\nHad you thought of it before, or is it new to you?\n\nI'm happy to go into the money, the time it takes or how to get started. Or we can move on to the next one. **What do you think?**",
  },
  top_career_3: {
    intro: null,
    outro:
      "And that was your third direction. **What's your first reaction? Does it feel like a good fit**, or less so?\n\nDoes anything about it stand out, good or bad?\n\nAsk me about any detail you're curious about. Or we can move on to a few close alternatives for a quick comparison. **How would you like to continue?**",
  },
  runner_ups: {
    intro:
      "Here are a few **close alternatives** to your top three. They also suit your strengths and wishes, but differ in what you'd do, where or how much. After this come the **outside-the-box** options: directions you might not have considered. Here they are:",
    outro:
      'Those were the close alternatives. **Do you have questions about any of them**, or anything else you\'d like to talk about?',
  },
  outside_box: {
    intro:
      "**The best fit isn't always the most obvious one.** Here are a few **outside-the-box options**: directions that suit who you are, but might not have been on your radar. Let's take a look:",
    outro:
      "**Does any of these appeal to you?** Even if they're unfamiliar, they might be a new way to use what you're good at. **Let me know what you think**, or ask about any of them. After this, we'll take an honest look at your own idea.",
  },
  dream_jobs: {
    intro:
      "You mentioned an idea of your own: something you already tried or keep coming back to. Here's an honest look at it: what it would take, what to watch for, and a small way to try it before you commit.",
    outro: null,
  },
};

const ENCORE_NL: Record<SectionType, Boilerplate> = {
  approach: {
    intro:
      'We beginnen bij u. Eerst hoe u nu het beste werkt: waar uw energie naartoe gaat, en wat u liever achter u laat.',
    outro:
      '**Herkent u zich hierin?** Laat het weten als er iets niet klopt of ontbreekt, dan neem ik dat mee in uw rapport.',
  },
  strengths: {
    intro: 'Dan wat u meebrengt: de kwaliteiten die steeds terugkomen in uw antwoorden en uw ervaring.',
    outro: '**Herkent u zich hierin?** Als u iets anders zou zeggen, laat het gerust weten.',
  },
  development: {
    intro:
      'Nu een paar aandachtspunten: gewoonten en valkuilen die goed zijn om te kennen voordat u iets nieuws begint.',
    outro: '**Klopt dit voor u?** Laat het weten als u het anders ziet of over een punt wilt praten.',
  },
  values: {
    intro: 'Tot slot in dit deel: wat nu voor u telt, en wat dat betekent voor het soort bezigheid dat bij u past.',
    outro:
      '**Geeft dit goed weer wat voor u belangrijk is?** Dan gaan we verder met de richtingen die bij u passen. Laat weten hoe u verder wilt.',
  },
  top_career_1: {
    intro:
      '## HOOFDSTUK 2: RICHTINGEN VOOR U\n\nNu de richtingen die volgens ons bij u passen, en waarom. We beginnen met uw top drie.\n\nOp basis van uw antwoorden, uw ervaring en wat u zoekt, past deze richting het beste bij u:',
    outro:
      'Dat was uw eerste richting.\n\n**Spreekt dit u aan? Ziet u zichzelf dit doen?**\n\nHad u deze verwacht, of is het een verrassing?\n\nIk kan meer vertellen over hoe dit er in de praktijk uitziet, of hoe mensen ermee beginnen. Of we gaan door naar de volgende richting. **Hoe wilt u verder?**',
  },
  top_career_2: {
    intro: null,
    outro:
      'Dat was uw tweede richting. **Hoe verhoudt deze zich tot de eerste? Ziet u zichzelf dit doen?**\n\nHad u hier al eens aan gedacht, of is het nieuw voor u?\n\nIk ga graag in op het geld, de tijd die het kost of hoe u kunt beginnen. Of we gaan door naar de volgende. **Wat vindt u ervan?**',
  },
  top_career_3: {
    intro: null,
    outro:
      'En dat was uw derde richting. **Wat is uw eerste reactie? Voelt dit als een goede match**, of minder?\n\nSpringt er iets uit, positief of negatief?\n\nVraag gerust naar elk detail. Of we gaan door naar een paar alternatieven die er dicht bij liggen. **Hoe wilt u verder?**',
  },
  runner_ups: {
    intro:
      'Hier zijn een paar **alternatieven** die dicht bij uw top drie liggen. Ze passen ook bij uw sterke punten en wensen, maar verschillen in wat u doet, waar of hoeveel. Daarna volgen de **outside-the-box** opties: richtingen waar u misschien nog niet aan dacht. Dit zijn ze:',
    outro:
      'Dat waren de alternatieven. **Heeft u vragen over een van deze richtingen**, of wilt u ergens anders over praten?',
  },
  outside_box: {
    intro:
      '**De beste keuze is niet altijd de meest voor de hand liggende.** Hier zijn een paar **outside-the-box opties**: richtingen die bij u passen, maar misschien nog niet in beeld waren. Laten we kijken:',
    outro:
      '**Spreekt een van deze u aan?** Ook als ze onbekend voelen, kunnen ze een nieuwe manier zijn om in te zetten waar u goed in bent. **Laat weten wat u ervan vindt**, of vraag naar een van deze opties. Hierna kijken we eerlijk naar uw eigen idee.',
  },
  dream_jobs: {
    intro:
      'U noemde een eigen idee: iets wat u al eens probeerde of waar u steeds op terugkomt. Hier kijken we er eerlijk naar: wat ervoor nodig is, waar u op moet letten, en hoe u het in het klein kunt uitproberen voordat u zich vastlegt.',
    outro: null,
  },
};

// Encore outside_box outro when the person left Q3.5 (their own idea) empty:
// there is no idea section after it, so it points to wrapping up.
const ENCORE_OUTSIDE_BOX_LAST_OUTRO: Record<Language, string> = {
  en: "**Does any of these appeal to you?** Even if they're unfamiliar, they might be a new way to use what you're good at. **Let me know what you think**, or ask about any of them. This was the last part: when you're ready, you can wrap up the session.",
  nl: '**Spreekt een van deze u aan?** Ook als ze onbekend voelen, kunnen ze een nieuwe manier zijn om in te zetten waar u goed in bent. **Laat weten wat u ervan vindt**, of vraag naar een van deze opties. Dit was het laatste onderdeel: als u klaar bent, kunt u de sessie afronden.',
};

export const BOILERPLATE: Record<Language, Record<SectionType, Boilerplate>> = {
  en: EN,
  nl: NL,
};

export interface BoilerplateOptions {
  /** Encore report: use Encore's own voice ("u" in Dutch). */
  encore?: boolean;
  /** Encore only: false when no idea section follows outside_box. */
  expectsDreamJobs?: boolean;
}

/**
 * Get boilerplate for a given language, falling back to English if the
 * language is unknown. Callers should pass `preferred_language` from the
 * user's profile (or 'en' if not set). Pro/Starter callers pass no options
 * and get exactly the Pro copy.
 */
export function getBoilerplate(
  language: string,
  options: BoilerplateOptions = {},
): Record<SectionType, Boilerplate> {
  const lang: Language = language === 'nl' ? 'nl' : 'en';
  if (!options.encore) return lang === 'nl' ? NL : EN;
  const base = lang === 'nl' ? ENCORE_NL : ENCORE_EN;
  if (options.expectsDreamJobs !== false) return base;
  return {
    ...base,
    outside_box: { ...base.outside_box, outro: ENCORE_OUTSIDE_BOX_LAST_OUTRO[lang] },
  };
}

// Wrap-up message after the user signals they're done with dream_jobs.
// Triggered by the "All done, wrap up session" QuickReply.
const DREAM_JOBS_WRAP_UP_BY_LANG: Record<Language, string> = {
  en: "That concludes your Cairnly career chat session. Behind the scenes, we're now generating your personalized executive summary based on everything we discussed, including your feedback. Your complete report with the executive summary and all career recommendations will be ready shortly in your dashboard.\n\nYou'll receive an email when it's available. You can revisit this report anytime to reflect on these findings or share it with mentors, career advisors, or anyone else who can support your next steps.\n\nYou know where you stand. Now decide where you're going.",
  nl: "Hiermee sluiten we je Cairnly loopbaanchat-sessie af. Achter de schermen genereren we nu je persoonlijke samenvatting op basis van alles wat we besproken hebben, inclusief je feedback. Je volledige rapport met de samenvatting en alle loopbaanaanbevelingen is binnenkort klaar in je dashboard.\n\nJe krijgt een mail zodra het beschikbaar is. Je kunt dit rapport altijd opnieuw bekijken om over deze inzichten te reflecteren, of deel het met mentoren, loopbaanadviseurs, of iedereen die je verdere stappen kan ondersteunen.\n\nJe weet waar je staat. Bepaal nu waar je heen gaat.",
};

export function getDreamJobsWrapUp(language: string): string {
  if (language === 'nl') return DREAM_JOBS_WRAP_UP_BY_LANG.nl;
  return DREAM_JOBS_WRAP_UP_BY_LANG.en;
}

// Back-compat exports — keep the old constant names available so any existing
// importers in the codebase don't break. New code should use getBoilerplate()
// and getDreamJobsWrapUp() with the user's preferred_language.
export const DREAM_JOBS_WRAP_UP = DREAM_JOBS_WRAP_UP_BY_LANG.en;
