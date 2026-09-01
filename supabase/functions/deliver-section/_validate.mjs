// Self-contained validation harness — no network calls.
// Embeds two real rows from `report_sections` and the matching agent
// outputs from `n8n_chat_histories`, runs the renderer, prints diffs.
//
//   node supabase/functions/deliver-section/_validate.mjs

// --- Boilerplate (subset; only the cases under test) ---
const BOILERPLATE = {
  values: {
    intro: "Finally, let's look at your core values - what matters most to you in your career and how that shapes the right fit.",
    outro: "**Does this section reflect what matters most to you?** If everything looks good, we can move on to your career recommendations. Let me know how you'd like to proceed.",
  },
  top_career_1: {
    intro: "## CHAPTER 2: CAREER RECOMMENDATIONS\n\nOk! Let's continue with our career recommendations and discuss why we think they are a great fit for you. We start with your top career matches first.\n\nBased on your personality, values, and skills, one of the most suitable jobs for you is:",
    outro: "That was your first top career match.\n\nBased on what we just covered, **does this role appeal to you? Does it align with your career goals and interests?**\n\nWere you expecting to see this as a top recommendation, or was it a surprise?\n\nIf you'd like, I can provide more details, whether that's diving into the daily responsibilities, potential career paths, or industry trends. Or, if you're ready, we can move on to the next career match. **Let me know how you'd like to proceed!**",
  },
};

// --- Renderer (mirrors renderer.ts) ---
function stripInlineTags(s) {
  let out = s.replace(/<strong>([\s\S]*?)<\/strong>/gi, '$1');
  out = out.trim();
  if (out.startsWith('**') && out.endsWith('**')) {
    const inner = out.slice(2, -2);
    if (!inner.includes('**')) out = inner;
  }
  return out.trim();
}

function htmlToMarkdown(input) {
  if (!input) return '';
  let s = input;
  s = s.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_m, inner) => `### ${stripInlineTags(inner)}`);
  s = s.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (_m, inner) => `#### ${stripInlineTags(inner)}`);
  s = s.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, (_m, inner) => `##### ${stripInlineTags(inner)}`);
  s = s.replace(/<strong>([\s\S]*?)<\/strong>/gi, '**$1**');
  s = s.replace(/<\/?[a-z][^>]*>/gi, '');
  s = s.replace(/\s*\[\d+[a-z]\]/g, '');
  s = s.replace(/\s*\*?\*?More details[^\n]*$/i, '');
  return s.trim();
}

const ALT_TITLES_LABEL = {
  en: 'Alternate titles:',
  nl: 'Alternatieve functietitels:',
};

function altTitlesLabel(language) {
  const key = String(language ?? 'en').slice(0, 2).toLowerCase();
  return ALT_TITLES_LABEL[key] ?? ALT_TITLES_LABEL.en;
}

// NOTE: the deployed renderer also passes the text through companyContext()
// for Dutch. That map is TS-only, so this mirror covers the English path;
// the NL size translation is asserted against the REAL renderer via
// `deno eval` (see repo history / run it with deno if you touch renderSizeLine).
function renderSizeLine(raw, _language) {
  const text = htmlToMarkdown(raw)
    .replace(/^#+\s*/, '')
    .replace(/\*\*/g, '')
    .trim();
  return text ? `#### ${text}` : '';
}

function renderAltTitlesLine(raw, language) {
  const text = htmlToMarkdown(raw)
    .replace(/\*\*/g, '')
    .replace(/^(Alternate titles|Alternatieve functietitels)\s*:\s*/i, '')
    .trim();
  return text ? `**${altTitlesLabel(language)}** ${text}` : '';
}

function renderCareerCard(row, language = 'en') {
  const parts = [];
  const title = htmlToMarkdown(row.title);
  if (title) parts.push(title);
  const size = renderSizeLine(row.company_size_type, language);
  if (size) parts.push(size);
  const alts = renderAltTitlesLine(row.alternate_titles, language);
  if (alts) parts.push(alts);
  const header = parts.join('\n\n');
  const body = htmlToMarkdown(row.content);
  return [header, body].filter(Boolean).join('\n\n');
}

function renderPersonality(row) {
  const title = (row.title ?? '').trim();
  const content = htmlToMarkdown(row.content);
  return `### ${title}\n\n${content}`.trim();
}

function wrap(intro, body, outro) {
  const parts = [];
  if (intro) parts.push(intro);
  parts.push('---');
  parts.push(body);
  parts.push('---');
  if (outro) parts.push(outro);
  return parts.join('\n\n').trim();
}

// --- Test data (real rows from report c725e198-...) ---

const VALUES_ROW = {
  section_type: 'values',
  title: 'Aligning with Your Values',
  alternate_titles: null,
  company_size_type: null,
  content: "<h5>Identifying Your Core Values</h5>\n\nAutonomy sits at the top of your values list, and your career history backs it up consistently. Your highest-scoring roles gave you real authority, broad scope, and room to make decisions. Your lowest-scoring role was slow, narrow, and controlled. You are not someone who tolerates constraints well when they feel arbitrary or limiting.\n\nHelping others and making an impact rank second, which aligns with your draw toward people-focused work, your interest in human behavior, and your dream of roles like Chief People Officer or owning an education-focused business. These are not disconnected. They reflect a coherent thread: you want to shape how people develop, perform, and experience their work.\n\n<h5>Values in Career Decisions</h5>\n\nAccomplishment and recognition rank third. That matters more than it might appear. You are not looking for quiet, behind-the-scenes work. You want your contributions seen and acknowledged. This should factor directly into how you evaluate roles. Positions with high visibility, strategic influence, and clear ownership of outcomes will suit you better than roles where your work gets absorbed into someone else's agenda.\n\nYour lower ranking for work-life balance is worth examining. You listed it seventh, but also stated it is \"very important\" to you. That tension shows up in your habits too: you take on too much, you have a 9-to-5 preference, but your career has likely demanded more. The gap between what you say you value and how you currently operate is worth closing deliberately.\n\n<h5>Key Insight</h5>\n\nYou have framed your current goal as finding a career path that better suits your skills and interests. But your values data and happiness scores suggest the issue is less about the type of work and more about the conditions surrounding it. Your highest-scoring roles were not defined by sector or job title. They were defined by autonomy, strong management relationships, and meaningful scope. Those conditions can exist in multiple contexts. The question worth sitting with is not \"what should I do next?\" but \"what conditions do I need, and how do I make them non-negotiable going forward?\"",
};

const VALUES_AGENT_OUTPUT = "Finally, let's look at your core values - what matters most to you in your career and how that shapes the right fit.\n\n---\n\n### Aligning with Your Values\n\n##### Identifying Your Core Values\n\nAutonomy sits at the top of your values list, and your career history backs it up consistently. Your highest-scoring roles gave you real authority, broad scope, and room to make decisions. Your lowest-scoring role was slow, narrow, and controlled. You are not someone who tolerates constraints well when they feel arbitrary or limiting.\n\nHelping others and making an impact rank second, which aligns with your draw toward people-focused work, your interest in human behavior, and your dream of roles like Chief People Officer or owning an education-focused business. These are not disconnected. They reflect a coherent thread: you want to shape how people develop, perform, and experience their work.\n\n##### Values in Career Decisions\n\nAccomplishment and recognition rank third. That matters more than it might appear. You are not looking for quiet, behind-the-scenes work. You want your contributions seen and acknowledged. This should factor directly into how you evaluate roles. Positions with high visibility, strategic influence, and clear ownership of outcomes will suit you better than roles where your work gets absorbed into someone else's agenda.\n\nYour lower ranking for work-life balance is worth examining. You listed it seventh, but also stated it is \"very important\" to you. That tension shows up in your habits too: you take on too much, you have a 9-to-5 preference, but your career has likely demanded more. The gap between what you say you value and how you currently operate is worth closing deliberately.\n\n##### Key Insight\n\nYou have framed your current goal as finding a career path that better suits your skills and interests. But your values data and happiness scores suggest the issue is less about the type of work and more about the conditions surrounding it. Your highest-scoring roles were not defined by sector or job title. They were defined by autonomy, strong management relationships, and meaningful scope. Those conditions can exist in multiple contexts. The question worth sitting with is not \"what should I do next?\" but \"what conditions do I need, and how do I make them non-negotiable going forward?\"\n\n---\n\n**Does this section reflect what matters most to you?** If everything looks good, we can move on to your career recommendations. Let me know how you'd like to proceed.";

const TOP1_ROW = {
  section_type: 'top_career_1',
  title: '<h3><strong>Independent Supervisory Board Member (Portfolio)</strong></h3>',
  alternate_titles: '<strong>Alternate titles:</strong> Non-Executive Director (NED), Independent Board Advisor, Board Governor',
  company_size_type: '<h4><strong>Medium (51–200) / Scale-up</strong></h4>',
  content: "<h5>Why this role fits you</h5>\n\nYou rated your Toggl board seat 9/10, calling it \"highly strategic work, limited commitment, excellent pay.\" This career doesn't approximate that model — it *is* that model, replicated across multiple seats. Your Personality Analysis identifies your core edge as \"translation\" — converting financial data into people decisions — and that's precisely what board oversight demands at every meeting.\n\nThe scale-up environment works for you specifically because it's where strategic input still visibly moves the needle. You value autonomy above everything else [3a], and a portfolio of board seats gives you the most structurally protected version of that: no single employer, no single CEO to report to, no political culture to absorb daily. The periodic format also directly addresses your \"ceiling on social input\" — you engage intensely, then step away.\n\n<h5>What you'll actually do</h5>\n\n- Review and approve strategic plans and financial budgets — your Strategic Finance background makes this natural territory, even if numbers aren't where your energy peaks\n- Evaluate CEO performance and oversee succession planning — this draws directly on your People leadership expertise from Cogna and Mavenoid, framing talent decisions at the highest level\n- Monitor corporate risk and legal compliance — your governance work at Toggl, including the strategic product pivot, is exactly the experience boards are hiring for\n- Provide critical questioning during board sessions — your analogy-driven communication style [2d] is an asset here; you make complex issues legible to a room of specialists\n\n<h5>What works for you</h5>\n\n✓ Maximum autonomy, minimum overhead. Your #1 value [3a] is structurally baked in — no internal politics, no line management, no CEO dynamics that produced the 7/10 frustration at Mews.\n\n✓ Intermittent schedule protects your energy. Quarterly meetings and structured preparation windows fit your 9-to-5 preference [3d] and prevent the \"pure exhaustion\" bottleneck pattern your Personality Analysis flags.\n\n✓ High-stakes strategy without operational grind. You found TomTom \"boring and too slow\" at 4/10. Board work is the opposite — concentrated, consequential, and intellectually demanding without repetitive execution.\n\n✓ Salary ceiling scales with seat count. At €20,000–€60,000 per seat, three to four seats puts you comfortably in your £150,000–£250,000 target range [3f].\n\n<h5>The Reality Check</h5>\n\n⚠ Building a portfolio takes time and active networking. Your short-term goal is to expand your professional network [7a], which is necessary here — board seats don't come through job boards. This is the single real constraint on this path.\n\n⚠ Finance oversight is unavoidable. You list Strategic Finance as a top skill, but budget and audit reviews are a regular feature of board work. Based on your profile, this is tolerable, not energizing — manageable, but worth being honest about.\n\n⚠ Influence without authority will test your directness. Your Personality Analysis notes you can come across as abrasive in political cultures. Board effectiveness requires diplomatic challenge, not just correct challenge. The instinct to be direct is right; the delivery needs calibration.\n\n⚠ One seat isn't enough income. This is a portfolio career, not a single appointment. Until you hold three or more active seats, income will be below target. Plan for an 18–24 month build period alongside another role.\n\n<h5>The practical stuff</h5>\n\nMoney: €20,000–€60,000 per board seat. Two to four seats gets you to your £150,000–£250,000 bracket, but income is staged — you won't hit target immediately.\n\nSchedule: Intermittent, structured around quarterly board meetings and committee sessions. Fully compatible with a 9-to-5 preference and your personal constraints.\n\nEnergy: Low to moderate social interaction, concentrated and high-stakes. Well-matched to your \"enjoy people, but need a break from them\" social profile [2a].\n\nGrowth: This path leads toward Board Chair, specialist committee leadership (Remuneration, Audit), or a full professional portfolio career — each step increasing both fee level and strategic influence.\n\n<h5>How AI will impact this role</h5>\n\nThis role carries a Low AI impact rating. Governance, fiduciary accountability, and ethical judgment require human presence and legal responsibility that can't be delegated to a model. Where AI does enter the picture is in board pack data visualization and pre-meeting analysis — tools you're already equipped to use given your frequent AI use [4e]. The human judgment layer is what you're being paid for, and that remains firmly yours.\n\n<h5>Alignment with your ambitions</h5>\n\nThis is a direct extension of your 9/10 happiness model — not a guess, a proven result. It aligns with your long-term goal of establishing expertise and recognition [7b] and moves toward financial independence without requiring you to rebuild an operational career from scratch. The honest catch: the path requires the networking you've historically deprioritized. That's the work.\n\nMore details about this role can be viewed in your dashboard after this chat.",
};

const TOP1_AGENT_OUTPUT = "---\n\n### Independent Supervisory Board Member (Portfolio)\n\n#### Medium (51–200) / Scale-up\n\n**Alternate titles:** Non-Executive Director (NED), Independent Board Advisor, Board Governor\n\n##### Why this role fits you\n\nYou rated your Toggl board seat 9/10, calling it \"highly strategic work, limited commitment, excellent pay.\" This career doesn't approximate that model — it *is* that model, replicated across multiple seats. Your Personality Analysis identifies your core edge as \"translation\" — converting financial data into people decisions — and that's precisely what board oversight demands at every meeting.\n\nThe scale-up environment works for you specifically because it's where strategic input still visibly moves the needle. You value autonomy above everything else, and a portfolio of board seats gives you the most structurally protected version of that: no single employer, no single CEO to report to, no political culture to absorb daily. The periodic format also directly addresses your \"ceiling on social input\" — you engage intensely, then step away.\n\n##### What you'll actually do\n\n- Review and approve strategic plans and financial budgets — your Strategic Finance background makes this natural territory, even if numbers aren't where your energy peaks\n- Evaluate CEO performance and oversee succession planning — this draws directly on your People leadership expertise from Cogna and Mavenoid, framing talent decisions at the highest level\n- Monitor corporate risk and legal compliance — your governance work at Toggl, including the strategic product pivot, is exactly the experience boards are hiring for\n- Provide critical questioning during board sessions — your analogy-driven communication style is an asset here; you make complex issues legible to a room of specialists\n\n##### What works for you\n\n✓ Maximum autonomy, minimum overhead. Your #1 value is structurally baked in — no internal politics, no line management, no CEO dynamics that produced the 7/10 frustration at Mews.\n\n✓ Intermittent schedule protects your energy. Quarterly meetings and structured preparation windows fit your 9-to-5 preference and prevent the \"pure exhaustion\" bottleneck pattern your Personality Analysis flags.\n\n✓ High-stakes strategy without operational grind. You found TomTom \"boring and too slow\" at 4/10. Board work is the opposite — concentrated, consequential, and intellectually demanding without repetitive execution.\n\n✓ Salary ceiling scales with seat count. At €20,000–€60,000 per seat, three to four seats puts you comfortably in your £150,000–£250,000 target range.\n\n##### The Reality Check\n\n⚠ Building a portfolio takes time and active networking. Your short-term goal is to expand your professional network, which is necessary here — board seats don't come through job boards. This is the single real constraint on this path.\n\n⚠ Finance oversight is unavoidable. You list Strategic Finance as a top skill, but budget and audit reviews are a regular feature of board work. Based on your profile, this is tolerable, not energizing — manageable, but worth being honest about.\n\n⚠ Influence without authority will test your directness. Your Personality Analysis notes you can come across as abrasive in political cultures. Board effectiveness requires diplomatic challenge, not just correct challenge. The instinct to be direct is right; the delivery needs calibration.\n\n⚠ One seat isn't enough income. This is a portfolio career, not a single appointment. Until you hold three or more active seats, income will be below target. Plan for an 18–24 month build period alongside another role.\n\n##### The practical stuff\n\nMoney: €20,000–€60,000 per board seat. Two to four seats gets you to your £150,000–£250,000 bracket, but income is staged — you won't hit target immediately.\n\nSchedule: Intermittent, structured around quarterly board meetings and committee sessions. Fully compatible with a 9-to-5 preference and your personal constraints.\n\nEnergy: Low to moderate social interaction, concentrated and high-stakes. Well-matched to your \"enjoy people, but need a break from them\" social profile.\n\nGrowth: This path leads toward Board Chair, specialist committee leadership (Remuneration, Audit), or a full professional portfolio career — each step increasing both fee level and strategic influence.\n\n##### How AI will impact this role\n\nThis role carries a Low AI impact rating. Governance, fiduciary accountability, and ethical judgment require human presence and legal responsibility that can't be delegated to a model. Where AI does enter the picture is in board pack data visualization and pre-meeting analysis — tools you're already equipped to use given your frequent AI use. The human judgment layer is what you're being paid for, and that remains firmly yours.\n\n##### Alignment with your ambitions\n\nThis is a direct extension of your 9/10 happiness model — not a guess, a proven result. It aligns with your long-term goal of establishing expertise and recognition and moves toward financial independence without requiring you to rebuild an operational career from scratch. The honest catch: the path requires the networking you've historically deprioritized. That's the work.\n\n---\n\nThat was your first top career match.\n\nBased on what we just covered, **does this role appeal to you? Does it align with your career goals and interests?**\n\nWere you expecting to see this as a top recommendation, or was it a surprise?\n\nIf you'd like, I can provide more details, whether that's diving into the daily responsibilities, potential career paths, or industry trends. Or, if you're ready, we can move on to the next career match. **Let me know how you'd like to proceed!**";

// --- Run tests ---

function lineDiff(a, b, label) {
  const aLines = a.split('\n');
  const bLines = b.split('\n');
  const max = Math.max(aLines.length, bLines.length);
  const diffs = [];
  for (let i = 0; i < max; i++) {
    if (aLines[i] !== bLines[i]) {
      diffs.push(`L${i + 1}:`);
      diffs.push(`  RENDER: ${JSON.stringify(aLines[i] ?? '<EOF>')}`);
      diffs.push(`  AGENT : ${JSON.stringify(bLines[i] ?? '<EOF>')}`);
    }
  }
  if (diffs.length === 0) {
    console.log(`${label}: IDENTICAL ✓`);
  } else {
    console.log(`${label}: ${diffs.length / 3} line diffs`);
    diffs.slice(0, 60).forEach((d) => console.log(d));
  }
}

console.log('=== values (id 489) ===');
{
  const bp = BOILERPLATE.values;
  const rendered = wrap(bp.intro, renderPersonality(VALUES_ROW), bp.outro);
  lineDiff(rendered, VALUES_AGENT_OUTPUT, 'values');
}

console.log('\n=== top_career_1 (id 495) ===');
{
  const bp = BOILERPLATE.top_career_1;
  const rendered = wrap(bp.intro, renderCareerCard(TOP1_ROW), bp.outro);
  lineDiff(rendered, TOP1_AGENT_OUTPUT, 'top_career_1 — strict');

  // The agent dropped the chapter-2 intro (known bug). Strip the renderer's
  // chapter intro and compare what's left to confirm the rest is byte-equal.
  const renderedNoIntro = rendered.slice(rendered.indexOf('---'));
  console.log('\n— with chapter intro stripped from renderer:');
  lineDiff(renderedNoIntro, TOP1_AGENT_OUTPUT, 'top_career_1 — content-only');
}

// --- Shape tolerance: a row with BARE metadata (post-caption-removal WF4)
// must render byte-identically to the legacy captioned/markup shape. ---

const TOP1_ROW_CLEAN = {
  ...TOP1_ROW,
  alternate_titles: 'Non-Executive Director (NED), Independent Board Advisor, Board Governor',
  company_size_type: 'Medium (51–200) / Scale-up',
};

console.log('\n=== shape tolerance (legacy vs clean metadata) ===');
{
  const legacy = renderCareerCard(TOP1_ROW, 'en');
  const clean = renderCareerCard(TOP1_ROW_CLEAN, 'en');
  lineDiff(clean, legacy, 'clean vs legacy — en');

  const legacyNl = renderCareerCard(TOP1_ROW, 'nl');
  const cleanNl = renderCareerCard(TOP1_ROW_CLEAN, 'nl');
  lineDiff(cleanNl, legacyNl, 'clean vs legacy — nl');

  const nlHasLabel = legacyNl.includes('**Alternatieve functietitels:** Non-Executive Director');
  const nlNoEnglish = !legacyNl.includes('Alternate titles:');
  console.log(`nl caption swapped: ${nlHasLabel && nlNoEnglish ? 'OK ✓' : 'FAILED ✗'}`);

  const enHasLabel = clean.includes('**Alternate titles:** Non-Executive Director');
  const enHasHeading = clean.includes('#### Medium (51–200) / Scale-up');
  console.log(`en caption + heading on clean row: ${enHasLabel && enHasHeading ? 'OK ✓' : 'FAILED ✗'}`);
}
