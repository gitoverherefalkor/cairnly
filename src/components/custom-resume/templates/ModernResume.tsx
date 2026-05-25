// Modern / Minimalist designed template — Cairnly teal accent, Inter throughout.
// Audience: tech, startup, product, UX. References: Stripe careers' typographic
// confidence; Dieter Rams restraint.
//
// Ported from /handoff-package/resume-templates/templates/modern.jsx.

import { Document, Page, StyleSheet, Svg, Path, Text, View } from '@react-pdf/renderer';
import type { ResumeJson, ResumeExperience, ResumeEducation } from '../types';
import { renderDateRange } from './utils';
import { registerDesignedFonts } from './fonts';

registerDesignedFonts();

const MOD = {
  ink: '#0A1116',
  ink2: '#2E3A44',
  ink3: '#6B7A85',
  rule: '#E1E5E9',
  accent: '#27A1A1',
  page: '#FFFFFF',
  pad: 48,
};

const styles = StyleSheet.create({
  page: {
    paddingTop: MOD.pad + 12,
    paddingBottom: MOD.pad - 4,
    paddingHorizontal: MOD.pad,
    backgroundColor: MOD.page,
    fontFamily: 'Inter',
    fontSize: 9.5,
    lineHeight: 1.5,
    color: MOD.ink2,
  },

  headerWrap: { marginBottom: 24 },
  name: {
    fontFamily: 'Inter',
    fontSize: 30,
    fontWeight: 700,
    // Negative letter-spacing combined with the variable-Inter wght=700 axis
    // has rendered weirdly in some browser PDF viewers (only the first glyph
    // showing). Setting letterSpacing to 0 — a safer value that still reads
    // tight enough for a display name — until we ship a static Inter-Bold.ttf.
    letterSpacing: 0,
    color: MOD.ink,
    lineHeight: 1.1,
  },
  title: {
    fontSize: 12,
    fontWeight: 500,
    color: MOD.accent,
    marginTop: 8,
  },
  contactRow: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: '3 18',
    fontSize: 9,
    color: MOD.ink2,
  },
  contactCell: { flexDirection: 'row', alignItems: 'center' },
  accentRule: {
    marginTop: 14,
    height: 1.5,
    width: 32,
    backgroundColor: MOD.accent,
  },

  sectionLabel: {
    fontSize: 8.5,
    fontWeight: 600,
    letterSpacing: 1.7,
    textTransform: 'uppercase',
    color: MOD.accent,
    marginBottom: 8,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: MOD.rule,
  },
  section: { marginBottom: 14 },
  summarySection: { marginBottom: 18 },
  summaryBlock: {
    paddingLeft: 14,
    borderLeftWidth: 2,
    borderLeftStyle: 'solid',
    borderLeftColor: MOD.accent,
    fontSize: 10.5,
    lineHeight: 1.55,
    color: MOD.ink,
  },

  jobWrap: { marginBottom: 13 },
  jobRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 14,
  },
  jobTitle: {
    fontSize: 10.5,
    fontWeight: 600,
    color: MOD.ink,
    lineHeight: 1.3,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  jobDates: {
    fontSize: 9,
    color: MOD.ink3,
    flexShrink: 0,
    paddingTop: 2,
  },
  jobMeta: { fontSize: 9.5, color: MOD.ink2, marginTop: 1, marginBottom: 5 },
  jobMetaCompany: { fontWeight: 500 },
  jobMetaLoc: { color: MOD.ink3 },

  bullet: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  bulletDot: {
    width: 12,
    color: MOD.accent,
    fontWeight: 700,
    fontSize: 9.5,
    lineHeight: 1.5,
  },
  bulletText: {
    flex: 1,
    fontSize: 9.5,
    lineHeight: 1.5,
    color: MOD.ink2,
  },

  skillRow: { flexDirection: 'row', marginBottom: 3, fontSize: 9.5, lineHeight: 1.5 },
  skillGroup: { width: 78, fontWeight: 600, color: MOD.ink },
  skillItems: { flex: 1, color: MOD.ink2 },

  eduItem: { marginBottom: 7 },
  eduRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 14,
  },
  eduSchool: {
    fontSize: 10,
    fontWeight: 600,
    color: MOD.ink,
    lineHeight: 1.3,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  eduDates: { fontSize: 9, color: MOD.ink3, flexShrink: 0, paddingTop: 2 },
  eduDegree: { fontSize: 9.5, color: MOD.ink2 },

  certItem: {
    fontSize: 9.5,
    color: MOD.ink2,
    paddingLeft: 12,
    marginBottom: 2,
    lineHeight: 1.5,
  },

  pageMark: {
    position: 'absolute',
    bottom: 18,
    right: MOD.pad,
    fontSize: 8,
    color: MOD.ink3,
    letterSpacing: 0.65,
  },

  page2Header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8.5,
    fontWeight: 600,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: MOD.ink3,
    marginBottom: 18,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: MOD.rule,
  },
  page2HeaderName: { color: MOD.ink },
});

const IconWrap = { marginRight: 5 } as const;

// Tiny mono-line SVG icons — viewBox 0 0 16 16, 1.4 stroke.
function ModMail() {
  return (
    <Svg width={9} height={9} viewBox="0 0 16 16" style={IconWrap}>
      <Path d="M2 4h12v8H2zM2 4l6 5 6-5" stroke={MOD.ink3} strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function ModPhone() {
  return (
    <Svg width={9} height={9} viewBox="0 0 16 16" style={IconWrap}>
      <Path d="M3 3h3l2 4-2 1a8 8 0 0 0 4 4l1-2 4 2v3a1 1 0 0 1-1 1A12 12 0 0 1 2 4a1 1 0 0 1 1-1z" stroke={MOD.ink3} strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function ModPin() {
  return (
    <Svg width={9} height={9} viewBox="0 0 16 16" style={IconWrap}>
      <Path d="M8 14s5-4.5 5-8a5 5 0 1 0-10 0c0 3.5 5 8 5 8zM8 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" stroke={MOD.ink3} strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function ModLink() {
  return (
    <Svg width={9} height={9} viewBox="0 0 16 16" style={IconWrap}>
      <Path d="M6.5 9.5l3-3M9 5l1.5-1.5a2.5 2.5 0 0 1 3.5 3.5L12.5 8.5M7 11.5L5.5 13a2.5 2.5 0 0 1-3.5-3.5L3.5 8" stroke={MOD.ink3} strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function ModGlobe() {
  return (
    <Svg width={9} height={9} viewBox="0 0 16 16" style={IconWrap}>
      <Path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM1.5 8h13M8 1.5a10 10 0 0 1 0 13M8 1.5a10 10 0 0 0 0 13" stroke={MOD.ink3} strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function Header({ data }: { data: ResumeJson }) {
  const c = data.contact;
  return (
    <View style={styles.headerWrap}>
      <Text style={styles.name}>{c.name}</Text>
      {c.title ? <Text style={styles.title}>{c.title}</Text> : null}
      <View style={styles.contactRow}>
        {c.email ? (
          <View style={styles.contactCell}>
            <ModMail />
            <Text>{c.email}</Text>
          </View>
        ) : null}
        {c.phone ? (
          <View style={styles.contactCell}>
            <ModPhone />
            <Text>{c.phone}</Text>
          </View>
        ) : null}
        {c.location ? (
          <View style={styles.contactCell}>
            <ModPin />
            <Text>{c.location}</Text>
          </View>
        ) : null}
        {c.linkedin ? (
          <View style={styles.contactCell}>
            <ModLink />
            <Text>{c.linkedin}</Text>
          </View>
        ) : null}
        {c.portfolio ? (
          <View style={styles.contactCell}>
            <ModGlobe />
            <Text>{c.portfolio}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.accentRule} />
    </View>
  );
}

function Summary({ summary }: { summary: string }) {
  return (
    <View style={styles.summarySection}>
      <Text style={styles.sectionLabel}>Summary</Text>
      <Text style={styles.summaryBlock}>{summary}</Text>
    </View>
  );
}

function Job({ job }: { job: ResumeExperience }) {
  // wrap left default (true) so long jobs can split their bullets across
  // a page boundary. The previous wrap={false} forced an atomic job and was
  // pushing an 8-bullet item to the next page, leaving half a page of
  // whitespace behind. The title row stays glued to at least the first
  // bullet via the inner `wrap={false}` on jobRow + first bullet.
  return (
    <View style={styles.jobWrap}>
      {/* Keep the job header + first bullet together so we never page-break
          a job at "company line, then nothing". */}
      <View wrap={false}>
        <View style={styles.jobRow}>
          <Text style={styles.jobTitle}>{job.title}</Text>
          <Text style={styles.jobDates}>{renderDateRange(job)}</Text>
        </View>
        <Text style={styles.jobMeta}>
          <Text style={styles.jobMetaCompany}>{job.company}</Text>
          {job.location ? <Text style={styles.jobMetaLoc}> · {job.location}</Text> : null}
        </Text>
        {job.bullets?.[0] ? (
          <View style={styles.bullet}>
            <Text style={styles.bulletDot}>·</Text>
            <Text style={styles.bulletText}>{job.bullets[0]}</Text>
          </View>
        ) : null}
      </View>
      {job.bullets?.slice(1).map((b, i) => (
        <View key={i + 1} style={styles.bullet}>
          <Text style={styles.bulletDot}>·</Text>
          <Text style={styles.bulletText}>{b}</Text>
        </View>
      ))}
    </View>
  );
}

// The design source uses an object like { Research: [...], Tools: [...] }.
// Our ResumeJson stores skills_grouped with fixed buckets; map them to
// reader-friendly labels here.
const SKILL_LABELS: Record<keyof ResumeJson['skills_grouped'], string> = {
  technical: 'Technical',
  tools: 'Tools',
  soft: 'Strengths',
  languages: 'Languages',
};

function Skills({ skills }: { skills: ResumeJson['skills_grouped'] }) {
  const entries = (Object.keys(SKILL_LABELS) as (keyof typeof SKILL_LABELS)[])
    .map((k) => [SKILL_LABELS[k], skills[k] ?? []] as const)
    .filter(([, items]) => items.length > 0);
  if (entries.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>Skills</Text>
      {entries.map(([label, items]) => (
        <View key={label} style={styles.skillRow}>
          <Text style={styles.skillGroup}>{label}</Text>
          <Text style={styles.skillItems}>{items.join(' · ')}</Text>
        </View>
      ))}
    </View>
  );
}

function Education({ education }: { education: ResumeEducation[] }) {
  if (!education?.length) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>Education</Text>
      {education.map((ed, i) => (
        <View key={i} style={styles.eduItem} wrap={false}>
          <View style={styles.eduRow}>
            <Text style={styles.eduSchool}>{ed.institution}</Text>
            <Text style={styles.eduDates}>{renderDateRange(ed)}</Text>
          </View>
          <Text style={styles.eduDegree}>
            {[ed.degree, ed.field].filter(Boolean).join(', ')}
            {ed.location ? `  ·  ${ed.location}` : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

function CertsOrHighlights({
  certs,
  highlights,
}: {
  certs?: ResumeJson['certifications'];
  highlights?: ResumeJson['highlights'];
}) {
  const items: { key: string; text: string }[] = [];
  certs?.forEach((c, i) =>
    items.push({
      key: `c${i}`,
      text: [c.name, c.issuer ? `— ${c.issuer}` : '', c.year ? `(${c.year})` : ''].filter(Boolean).join(' '),
    }),
  );
  highlights?.forEach((h, i) => items.push({ key: `h${i}`, text: h }));
  if (items.length === 0) return null;
  const label = certs?.length && highlights?.length ? 'Certifications & Highlights' : certs?.length ? 'Certifications' : 'Highlights';
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {items.map((it) => (
        <View key={it.key} style={styles.bullet}>
          <Text style={styles.bulletDot}>·</Text>
          <Text style={styles.bulletText}>{it.text}</Text>
        </View>
      ))}
    </View>
  );
}

function PageMark({ name }: { name: string }) {
  const parts = name.split(/\s+/).filter(Boolean);
  const first = (parts[0] ?? '').toUpperCase();
  const last = (parts.length > 1 ? parts[parts.length - 1] : '').toUpperCase();
  // react-pdf re-evaluates render() per page, so the numbering stays right
  // even if the second Page auto-wraps onto a third / fourth physical page.
  return (
    <Text
      style={styles.pageMark}
      fixed
      render={({ pageNumber, totalPages }) =>
        `${first} ${last} · ${pageNumber}/${totalPages}`
      }
    />
  );
}

interface ModernResumeProps {
  data: ResumeJson;
}

export function ModernResume({ data }: ModernResumeProps) {
  const expCount = data.experience?.length ?? 0;
  const isMulti = expCount >= 4;
  const splitAt = 3;
  const p1 = isMulti ? data.experience.slice(0, splitAt) : data.experience;
  const p2 = isMulti ? data.experience.slice(splitAt) : [];

  return (
    <Document title={`${data.contact.name} — Résumé`} author={data.contact.name}>
      <Page size="LETTER" style={styles.page}>
        <Header data={data} />
        {data.summary ? <Summary summary={data.summary} /> : null}
        {p1.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Experience</Text>
            {p1.map((j, i) => (
              <Job key={i} job={j} />
            ))}
          </View>
        ) : null}
        {!isMulti ? (
          <>
            <Skills skills={data.skills_grouped} />
            <Education education={data.education} />
            <CertsOrHighlights certs={data.certifications} highlights={data.highlights} />
          </>
        ) : null}
        {isMulti ? <PageMark name={data.contact.name} /> : null}
      </Page>

      {isMulti ? (
        <Page size="LETTER" style={styles.page}>
          <View style={styles.page2Header}>
            <Text style={styles.page2HeaderName}>{data.contact.name}</Text>
            <Text>Experience, continued</Text>
          </View>
          <View style={styles.section}>
            {p2.map((j, i) => (
              <Job key={i} job={j} />
            ))}
          </View>
          <Skills skills={data.skills_grouped} />
          <Education education={data.education} />
          <CertsOrHighlights certs={data.certifications} highlights={data.highlights} />
          <PageMark name={data.contact.name} />
        </Page>
      ) : null}
    </Document>
  );
}
