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
      "Let's take a look at your **runner-up career matches**. These roles are also well-suited to your strengths, values, and skills, but may differ in focus, work environment, or career trajectory compared to your top matches. Here are strong alternatives worth considering:",
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
      "Everyone has an idea of their ideal job, the one that aligns perfectly with their passions and ambitions. In this section, we take an honest look at how well your dream job(s) align with your personality, experience, and the realities of the job market today. Let's break it down.",
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
      "Laten we kijken naar je **runner-up matches**. Deze rollen passen ook goed bij je sterke punten, waarden en vaardigheden, maar verschillen mogelijk in focus, werkomgeving of loopbaantraject ten opzichte van je topmatches. Hier zijn sterke alternatieven om te overwegen:",
    outro:
      "Daarmee zijn we klaar met je runner-up matches! **Heb je vragen over een van deze rollen**, of is er iets anders dat je verder wilt verkennen?",
  },
  outside_box: {
    intro:
      "**Soms zijn de beste loopbaanpaden niet de meest voor de hand liggende.** Gebaseerd op je persoonlijkheid, interesses en waarden hebben we een paar **outside-the-box loopbaanopties** geïdentificeerd. Rollen die passen bij wie je bent, maar misschien nog niet op je radar stonden. Deze kunnen onverwachte maar zeer bevredigende kansen openen. Laten we kijken:",
    outro:
      "**Spreken een van deze rollen je aan?** Ook als ze buiten je gebruikelijke domein vallen, kunnen ze nieuwe manieren bieden om je sterke punten en interesses in te zetten op een manier die spannend en lonend voelt. **Laat je gedachten weten**: wil je meer details over een van deze rollen, of liever andere richtingen verkennen? Zo niet, dan kunnen we door naar een bonussegment: de haalbaarheid van je 'droombanen'!",
  },
  dream_jobs: {
    intro:
      "Iedereen heeft een idee van de ideale baan, eentje die perfect aansluit bij passies en ambities. In dit onderdeel kijken we eerlijk naar hoe goed je droombaan of -banen aansluiten bij je persoonlijkheid, ervaring, en de realiteit van de huidige arbeidsmarkt. Laten we het uitsplitsen.",
    outro: null,
  },
};

export const BOILERPLATE: Record<Language, Record<SectionType, Boilerplate>> = {
  en: EN,
  nl: NL,
};

/**
 * Get boilerplate for a given language, falling back to English if the
 * language is unknown. Callers should pass `preferred_language` from the
 * user's profile (or 'en' if not set).
 */
export function getBoilerplate(language: string): Record<SectionType, Boilerplate> {
  if (language === 'nl') return NL;
  return EN;
}

// Wrap-up message after the user signals they're done with dream_jobs.
// Triggered by the "All done, wrap up session" QuickReply.
const DREAM_JOBS_WRAP_UP_BY_LANG: Record<Language, string> = {
  en: "That concludes your Cairnly career chat session. Behind the scenes, we're now generating your personalized executive summary based on everything we discussed, including your feedback. Your complete report with the executive summary and all career recommendations will be ready shortly in your dashboard.\n\nYou'll receive an email when it's available. You can revisit this report anytime to reflect on these findings or share it with mentors, career advisors, or anyone else who can support your next steps.\n\nYou know where you stand. Now decide where you're going.",
  nl: "Hiermee sluiten we je Cairnly loopbaanchat-sessie af. Achter de schermen genereren we nu je persoonlijke samenvatting op basis van alles wat we besproken hebben, inclusief je feedback. Je volledige rapport met de samenvatting en alle loopbaanaanbevelingen is binnenkort klaar in je dashboard.\n\nJe krijgt een mail zodra het beschikbaar is. Je kunt dit rapport altijd opnieuw bekijken om over deze inzichten te reflecteren, of deel het met mentoren, loopbaanadviseurs, of iedereen die je verdere stappen kan ondersteunen.\n\nJe weet waar je staat. Nu bepalen waar je heen gaat.",
};

export function getDreamJobsWrapUp(language: string): string {
  if (language === 'nl') return DREAM_JOBS_WRAP_UP_BY_LANG.nl;
  return DREAM_JOBS_WRAP_UP_BY_LANG.en;
}

// Back-compat exports — keep the old constant names available so any existing
// importers in the codebase don't break. New code should use getBoilerplate()
// and getDreamJobsWrapUp() with the user's preferred_language.
export const DREAM_JOBS_WRAP_UP = DREAM_JOBS_WRAP_UP_BY_LANG.en;
