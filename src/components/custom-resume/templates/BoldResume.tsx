// Bold / Creative designed template — Bricolage Grotesque display + Inter body +
// JetBrains Mono meta. Cream paper, burnt-sienna accent. Asymmetric numbered
// section grid. Audience: marketing, communications, media, sales.
//
// Ported from /handoff-package/resume-templates/templates/bold.jsx.

import { Document, Page, StyleSheet, Svg, Path, Text, View } from '@react-pdf/renderer';
import type { ResumeJson } from '../types';
import { renderDateRange } from './utils';
import { registerDesignedFonts } from './fonts';

registerDesignedFonts();

const BD = {
  ink: '#141414',
  ink2: '#26241F',
  ink3: '#6E665C',
  paper: '#F7F1E6',
  paperDeep: '#EAE0CB',
  accent: '#C5432A',
  rule: '#1C1B19',
  rule2: '#D8CBB1',
  pad: 40,
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: BD.paper,
    fontFamily: 'Inter',
    fontSize: 9.5,
    lineHeight: 1.5,
    color: BD.ink2,
  },

  // Header band — full-bleed top, divider rule beneath.
  header: {
    paddingTop: BD.pad,
    paddingHorizontal: BD.pad,
    paddingBottom: 18,
    borderBottomWidth: 1.5,
    borderBottomStyle: 'solid',
    borderBottomColor: BD.rule,
  },
  titleEyebrow: {
    fontFamily: 'JetBrains Mono',
    fontSize: 7.75,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: BD.accent,
    marginBottom: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  name: {
    fontFamily: 'Bricolage Grotesque',
    fontSize: 46,
    fontWeight: 700,
    letterSpacing: -1.6,
    color: BD.ink,
    lineHeight: 0.95,
    flex: 1,
    minWidth: 0,
  },
  dot: {
    width: 36,
    height: 36,
    flexShrink: 0,
    backgroundColor: BD.accent,
    borderRadius: 999,
    marginTop: 6,
  },

  contactRow: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: '4 16',
    fontFamily: 'JetBrains Mono',
    fontSize: 8,
    letterSpacing: 0.32,
    textTransform: 'uppercase',
    color: BD.ink2,
  },
  contactCell: { flexDirection: 'row', alignItems: 'center' },
  contactPortfolioCell: {
    flexDirection: 'row',
    alignItems: 'center',
    color: BD.accent,
  },

  sectionWrap: {
    paddingTop: 14,
    paddingHorizontal: BD.pad,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 18,
  },
  sectionGutter: { width: 60, flexShrink: 0 },
  sectionNum: {
    fontFamily: 'Bricolage Grotesque',
    fontSize: 22,
    fontWeight: 700,
    color: BD.accent,
    lineHeight: 1,
    letterSpacing: -0.44,
  },
  sectionLabel: {
    fontFamily: 'JetBrains Mono',
    fontSize: 7.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: BD.ink,
    marginTop: 6,
  },
  sectionContent: { flex: 1, minWidth: 0, paddingTop: 2 },

  summaryBlock: {
    paddingLeft: 14,
    borderLeftWidth: 2,
    borderLeftStyle: 'solid',
    borderLeftColor: BD.accent,
    fontFamily: 'Bricolage Grotesque',
    fontSize: 13,
    fontWeight: 400,
    lineHeight: 1.4,
    color: BD.ink,
    letterSpacing: -0.13,
  },

  jobWrap: { marginBottom: 14 },
  jobTitleLine: {
    fontFamily: 'Bricolage Grotesque',
    fontSize: 13.5,
    fontWeight: 600,
    letterSpacing: -0.2,
    color: BD.ink,
    lineHeight: 1.15,
  },
  jobDash: { color: BD.accent },
  jobCompany: { fontWeight: 500 },
  jobMeta: {
    marginTop: 3,
    marginBottom: 5,
    fontFamily: 'JetBrains Mono',
    fontSize: 7.5,
    letterSpacing: 0.45,
    textTransform: 'uppercase',
    color: BD.ink3,
  },

  bullet: { flexDirection: 'row', marginBottom: 2 },
  bulletArrow: {
    width: 14,
    color: BD.accent,
    fontWeight: 700,
    fontSize: 10,
    lineHeight: 1.5,
  },
  bulletText: { flex: 1, fontSize: 9.5, lineHeight: 1.5, color: BD.ink2 },

  skillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: '5 5' },
  skillChip: {
    fontSize: 8.5,
    paddingTop: 3,
    paddingBottom: 3,
    paddingHorizontal: 8,
    backgroundColor: BD.paperDeep,
    color: BD.ink,
    borderRadius: 999,
    fontWeight: 500,
  },

  eduItem: { marginBottom: 7 },
  eduSchool: {
    fontFamily: 'Bricolage Grotesque',
    fontSize: 12,
    fontWeight: 600,
    color: BD.ink,
    letterSpacing: -0.12,
  },
  eduDegree: { fontSize: 9.5, color: BD.ink2, fontStyle: 'italic', marginTop: 1 },
  eduDates: {
    fontFamily: 'JetBrains Mono',
    fontSize: 7.5,
    color: BD.ink3,
    marginTop: 2,
    letterSpacing: 0.45,
    textTransform: 'uppercase',
  },

  diamondBullet: { flexDirection: 'row', marginBottom: 3 },
  diamondMark: {
    width: 14,
    color: BD.accent,
    fontWeight: 700,
    fontSize: 10,
  },

  footer: {
    marginTop: 18,
    paddingTop: 8,
    paddingBottom: 18,
    paddingHorizontal: BD.pad,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    fontFamily: 'JetBrains Mono',
    fontSize: 7.25,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: BD.ink3,
    borderTopWidth: 0.75,
    borderTopStyle: 'solid',
    borderTopColor: BD.rule2,
  },

  page2Header: {
    paddingTop: BD.pad - 10,
    paddingHorizontal: BD.pad,
    paddingBottom: 12,
    borderBottomWidth: 1.5,
    borderBottomStyle: 'solid',
    borderBottomColor: BD.rule,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  page2HeaderName: {
    fontFamily: 'Bricolage Grotesque',
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: -0.66,
    color: BD.ink,
  },
  page2HeaderMeta: {
    fontFamily: 'JetBrains Mono',
    fontSize: 7.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: BD.accent,
  },
});

const IconWrap = { marginRight: 5 } as const;
function BdMail() {
  return (
    <Svg width={9} height={9} viewBox="0 0 16 16" style={IconWrap}>
      <Path d="M2 4h12v8H2zM2 4l6 5 6-5" stroke={BD.ink2} strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function BdPhone() {
  return (
    <Svg width={9} height={9} viewBox="0 0 16 16" style={IconWrap}>
      <Path d="M3 3h3l2 4-2 1a8 8 0 0 0 4 4l1-2 4 2v3a1 1 0 0 1-1 1A12 12 0 0 1 2 4a1 1 0 0 1 1-1z" stroke={BD.ink2} strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function BdPin() {
  return (
    <Svg width={9} height={9} viewBox="0 0 16 16" style={IconWrap}>
      <Path d="M8 14s5-4.5 5-8a5 5 0 1 0-10 0c0 3.5 5 8 5 8zM8 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" stroke={BD.ink2} strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function BdLink({ accent = false }: { accent?: boolean }) {
  return (
    <Svg width={9} height={9} viewBox="0 0 16 16" style={IconWrap}>
      <Path d="M6.5 9.5l3-3M9 5l1.5-1.5a2.5 2.5 0 0 1 3.5 3.5L12.5 8.5M7 11.5L5.5 13a2.5 2.5 0 0 1-3.5-3.5L3.5 8" stroke={accent ? BD.accent : BD.ink2} strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function BoldHeader({ data }: { data: ResumeJson }) {
  const c = data.contact;
  return (
    <View style={styles.header}>
      {c.title ? <Text style={styles.titleEyebrow}>{c.title}</Text> : null}
      <View style={styles.nameRow}>
        <Text style={styles.name}>{c.name}</Text>
        <View style={styles.dot} />
      </View>
      <View style={styles.contactRow}>
        {c.email ? (
          <View style={styles.contactCell}>
            <BdMail />
            <Text>{c.email}</Text>
          </View>
        ) : null}
        {c.phone ? (
          <View style={styles.contactCell}>
            <BdPhone />
            <Text>{c.phone}</Text>
          </View>
        ) : null}
        {c.location ? (
          <View style={styles.contactCell}>
            <BdPin />
            <Text>{c.location}</Text>
          </View>
        ) : null}
        {c.linkedin ? (
          <View style={styles.contactCell}>
            <BdLink />
            <Text>{c.linkedin}</Text>
          </View>
        ) : null}
        {c.portfolio ? (
          <View style={styles.contactPortfolioCell}>
            <BdLink accent />
            <Text style={{ color: BD.accent }}>{c.portfolio}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function BoldSection({ num, label, children }: { num: string; label: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionWrap}>
      <View style={styles.sectionGutter}>
        <Text style={styles.sectionNum}>{num}</Text>
        <Text style={styles.sectionLabel}>{label}</Text>
      </View>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function Job({ job }: { job: ResumeJson['experience'][number] }) {
  return (
    <View style={styles.jobWrap} wrap={false}>
      <Text style={styles.jobTitleLine}>
        {job.title} <Text style={styles.jobDash}>—</Text>{' '}
        <Text style={styles.jobCompany}>{job.company}</Text>
      </Text>
      <Text style={styles.jobMeta}>
        {[renderDateRange(job), job.location].filter(Boolean).join('  ·  ')}
      </Text>
      {job.bullets?.map((b, i) => (
        <View key={i} style={styles.bullet}>
          <Text style={styles.bulletArrow}>→</Text>
          <Text style={styles.bulletText}>{b}</Text>
        </View>
      ))}
    </View>
  );
}

function flatSkills(s: ResumeJson['skills_grouped']): string[] {
  return [
    ...(s.technical ?? []),
    ...(s.tools ?? []),
    ...(s.soft ?? []),
    ...(s.languages ?? []),
  ];
}

function Footer({ data, page, total }: { data: ResumeJson; page?: number; total?: number }) {
  const right =
    total && total > 1
      ? `Page ${String(page).padStart(2, '0')} / ${String(total).padStart(2, '0')}`
      : (data.contact.portfolio || data.contact.email || '');
  const leftBits = [data.contact.name, data.contact.title].filter(Boolean).join(' · ');
  return (
    <View style={styles.footer}>
      <Text>{leftBits}</Text>
      <Text>{right}</Text>
    </View>
  );
}

interface BoldResumeProps {
  data: ResumeJson;
}

export function BoldResume({ data }: BoldResumeProps) {
  const isMulti = (data.experience?.length ?? 0) >= 4;
  const splitAt = 3;
  const p1 = isMulti ? data.experience.slice(0, splitAt) : data.experience;
  const p2 = isMulti ? data.experience.slice(splitAt) : [];

  const skills = flatSkills(data.skills_grouped);

  const SkillsSection =
    skills.length > 0 ? (
      <BoldSection num="03" label="Skills">
        <View style={styles.skillRow}>
          {skills.map((s, i) => (
            <Text key={i} style={styles.skillChip}>
              {s}
            </Text>
          ))}
        </View>
      </BoldSection>
    ) : null;

  const EducationSection =
    data.education?.length > 0 ? (
      <BoldSection num="04" label="Education">
        {data.education.map((ed, i) => (
          <View key={i} style={styles.eduItem} wrap={false}>
            <Text style={styles.eduSchool}>{ed.institution}</Text>
            <Text style={styles.eduDegree}>
              {[ed.degree, ed.field].filter(Boolean).join(', ')}
            </Text>
            <Text style={styles.eduDates}>{renderDateRange(ed)}</Text>
          </View>
        ))}
      </BoldSection>
    ) : null;

  const HighlightsSection =
    (data.highlights?.length ?? 0) > 0 || (data.certifications?.length ?? 0) > 0 ? (
      <BoldSection num="05" label="Recognition">
        {data.highlights?.map((h, i) => (
          <View key={`h${i}`} style={styles.diamondBullet}>
            <Text style={styles.diamondMark}>◆</Text>
            <Text style={styles.bulletText}>{h}</Text>
          </View>
        ))}
        {data.certifications?.map((c, i) => (
          <View key={`c${i}`} style={styles.diamondBullet}>
            <Text style={styles.diamondMark}>◆</Text>
            <Text style={styles.bulletText}>
              {c.name}
              {c.issuer ? ` — ${c.issuer}` : ''}
              {c.year ? ` (${c.year})` : ''}
            </Text>
          </View>
        ))}
      </BoldSection>
    ) : null;

  return (
    <Document title={`${data.contact.name} — Résumé`} author={data.contact.name}>
      <Page size="LETTER" style={styles.page}>
        <BoldHeader data={data} />
        {data.summary ? (
          <BoldSection num="01" label="Summary">
            <Text style={styles.summaryBlock}>{data.summary}</Text>
          </BoldSection>
        ) : null}
        {p1.length > 0 ? (
          <BoldSection num="02" label="Experience">
            {p1.map((j, i) => (
              <Job key={i} job={j} />
            ))}
          </BoldSection>
        ) : null}
        {!isMulti ? (
          <>
            {SkillsSection}
            {EducationSection}
            {HighlightsSection}
          </>
        ) : null}
        <Footer data={data} page={1} total={isMulti ? 2 : 1} />
      </Page>

      {isMulti ? (
        <Page size="LETTER" style={styles.page}>
          <View style={styles.page2Header}>
            <Text style={styles.page2HeaderName}>{data.contact.name}</Text>
            <Text style={styles.page2HeaderMeta}>Page 02 / 02</Text>
          </View>
          <BoldSection num="02" label="Experience, cont.">
            {p2.map((j, i) => (
              <Job key={i} job={j} />
            ))}
          </BoldSection>
          {SkillsSection}
          {EducationSection}
          {HighlightsSection}
          <Footer data={data} page={2} total={2} />
        </Page>
      ) : null}
    </Document>
  );
}
