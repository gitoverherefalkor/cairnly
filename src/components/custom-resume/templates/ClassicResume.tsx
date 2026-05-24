// Classic / Executive designed template — Source Serif 4 display + Inter body.
// Cream page, warm-paper sidebar, navy/burgundy accents. No icons by editorial
// convention. Audience: finance, consulting, law, healthcare leadership.
//
// Ported from /handoff-package/resume-templates/templates/classic.jsx.

import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ResumeJson } from '../types';
import { renderDateRange } from './utils';
import { registerDesignedFonts } from './fonts';

registerDesignedFonts();

const CL = {
  ink: '#0B1B26',
  ink2: '#1F3540',
  ink3: '#536B79',
  rule: '#B3A47D',
  rule2: '#D9D2C4',
  accent: '#0B3D5C',
  burgundy: '#7A1F2B',
  sidebar: '#F1ECDF',
  page: '#FBF8F1',
};

const SIDEBAR_W = 196;

const styles = StyleSheet.create({
  page: {
    backgroundColor: CL.page,
    fontFamily: 'Inter',
    fontSize: 9.5,
    lineHeight: 1.5,
    color: CL.ink2,
    flexDirection: 'row',
  },

  sidebar: {
    width: SIDEBAR_W,
    flexShrink: 0,
    backgroundColor: CL.sidebar,
    paddingTop: 44,
    paddingBottom: 36,
    paddingHorizontal: 22,
    borderRightWidth: 0.75,
    borderRightStyle: 'solid',
    borderRightColor: CL.rule,
    fontSize: 8.75,
  },
  sidebarBlock: { marginBottom: 18 },
  sidebarLabel: {
    fontFamily: 'Source Serif 4',
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: 1.98,
    textTransform: 'uppercase',
    color: CL.accent,
    marginBottom: 6,
  },
  sidebarLine: { color: CL.ink2, marginBottom: 2, lineHeight: 1.55 },
  sidebarItem: {
    color: CL.ink2,
    marginBottom: 3,
    lineHeight: 1.45,
    paddingLeft: 8,
  },
  sidebarItemRow: { flexDirection: 'row' },
  sidebarDash: { width: 8, color: CL.burgundy },
  sidebarItemText: { flex: 1, color: CL.ink2, lineHeight: 1.45 },
  sidebarSchool: {
    fontWeight: 600,
    color: CL.ink,
    lineHeight: 1.35,
    marginBottom: 1,
  },
  sidebarSchoolDates: { color: CL.ink3, fontSize: 8.25, marginTop: 1 },
  sidebarSchoolNote: {
    color: CL.ink3,
    fontSize: 8.25,
    marginTop: 2,
    lineHeight: 1.4,
    fontStyle: 'italic',
  },

  main: {
    flex: 1,
    paddingTop: 44,
    paddingBottom: 36,
    paddingLeft: 28,
    paddingRight: 30,
  },

  headerWrap: { marginBottom: 14 },
  name: {
    fontFamily: 'Source Serif 4',
    fontSize: 30,
    fontWeight: 600,
    color: CL.accent,
    lineHeight: 1.05,
  },
  roleEyebrow: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: CL.burgundy,
    marginTop: 6,
  },
  headerRule: { marginTop: 12, height: 0.75, backgroundColor: CL.rule },

  sectionLabel: {
    fontFamily: 'Source Serif 4',
    fontSize: 10.5,
    fontWeight: 600,
    letterSpacing: 2.31,
    textTransform: 'uppercase',
    color: CL.accent,
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 0.75,
    borderBottomStyle: 'solid',
    borderBottomColor: CL.rule,
  },
  section: { marginBottom: 16 },

  summary: {
    fontFamily: 'Source Serif 4',
    fontSize: 11,
    lineHeight: 1.55,
    color: CL.ink,
  },

  jobWrap: { marginBottom: 13 },
  jobRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  jobTitle: {
    fontFamily: 'Source Serif 4',
    fontSize: 11.5,
    fontWeight: 600,
    color: CL.ink,
    lineHeight: 1.25,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  jobDates: {
    fontSize: 8.5,
    color: CL.ink3,
    letterSpacing: 0.34,
    paddingTop: 3,
    flexShrink: 0,
  },
  jobMeta: { fontSize: 9.25, color: CL.ink2, marginTop: 2, marginBottom: 5 },
  jobMetaCompany: { fontStyle: 'italic' },
  jobMetaLoc: { color: CL.ink3 },

  bullet: { flexDirection: 'row', marginBottom: 2 },
  bulletDot: {
    width: 13,
    color: CL.burgundy,
    fontSize: 11,
    lineHeight: 1.4,
  },
  bulletText: {
    flex: 1,
    fontSize: 9.5,
    lineHeight: 1.5,
    color: CL.ink2,
  },

  page2HeaderName: {
    fontFamily: 'Source Serif 4',
    fontSize: 12,
    fontWeight: 600,
    color: CL.accent,
    marginBottom: 4,
  },
  page2HeaderEyebrow: {
    fontSize: 8.5,
    letterSpacing: 1.36,
    textTransform: 'uppercase',
    color: CL.burgundy,
    fontWeight: 600,
  },
  page2HeaderRule: {
    marginTop: 18,
    height: 0.75,
    backgroundColor: CL.rule,
    marginBottom: 18,
  },
  pageMark: {
    fontSize: 8,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: CL.ink3,
    textAlign: 'right',
    marginTop: 18,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopStyle: 'solid',
    borderTopColor: CL.rule2,
  },

  continuationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingBottom: 12,
    borderBottomWidth: 0.75,
    borderBottomStyle: 'solid',
    borderBottomColor: CL.rule,
    marginBottom: 18,
  },
  continuationName: {
    fontFamily: 'Source Serif 4',
    fontSize: 16,
    fontWeight: 600,
    color: CL.accent,
  },
  continuationPage: {
    fontSize: 8,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: CL.ink3,
  },
});

function flattenSkills(s: ResumeJson['skills_grouped']): string[] {
  return [
    ...(s.technical ?? []),
    ...(s.tools ?? []),
    ...(s.soft ?? []),
    ...(s.languages ?? []),
  ];
}

function Sidebar({ data, slim = false }: { data: ResumeJson; slim?: boolean }) {
  const c = data.contact;
  const skills = flattenSkills(data.skills_grouped);
  const langs = data.skills_grouped.languages ?? [];
  return (
    <View style={styles.sidebar}>
      <View style={styles.sidebarBlock}>
        <Text style={styles.sidebarLabel}>Contact</Text>
        {c.email ? <Text style={styles.sidebarLine}>{c.email}</Text> : null}
        {c.phone ? <Text style={styles.sidebarLine}>{c.phone}</Text> : null}
        {c.location ? <Text style={styles.sidebarLine}>{c.location}</Text> : null}
        {c.linkedin ? <Text style={styles.sidebarLine}>{c.linkedin}</Text> : null}
        {c.portfolio ? <Text style={styles.sidebarLine}>{c.portfolio}</Text> : null}
      </View>

      {!slim && skills.length > 0 ? (
        <View style={styles.sidebarBlock}>
          <Text style={styles.sidebarLabel}>Areas of Practice</Text>
          {skills.map((s, i) => (
            <View key={i} style={styles.sidebarItemRow}>
              <Text style={styles.sidebarDash}>—</Text>
              <Text style={styles.sidebarItemText}>{s}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {!slim && data.education?.length ? (
        <View style={styles.sidebarBlock}>
          <Text style={styles.sidebarLabel}>Education</Text>
          {data.education.map((ed, i) => (
            <View key={i} style={{ marginBottom: 8 }} wrap={false}>
              <Text style={styles.sidebarSchool}>{ed.institution}</Text>
              <Text style={{ lineHeight: 1.4, color: CL.ink2 }}>
                {[ed.degree, ed.field].filter(Boolean).join(', ')}
              </Text>
              <Text style={styles.sidebarSchoolDates}>{renderDateRange(ed)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {!slim && data.certifications?.length ? (
        <View style={styles.sidebarBlock}>
          <Text style={styles.sidebarLabel}>Certifications</Text>
          {data.certifications.map((cert, i) => (
            <Text key={i} style={{ color: CL.ink2, marginBottom: 4, lineHeight: 1.4 }}>
              {cert.name}
              {cert.issuer ? ` — ${cert.issuer}` : ''}
              {cert.year ? ` (${cert.year})` : ''}
            </Text>
          ))}
        </View>
      ) : null}

      {!slim && langs.length > 0 ? (
        <View style={styles.sidebarBlock}>
          <Text style={styles.sidebarLabel}>Languages</Text>
          {langs.map((l, i) => (
            <Text key={i} style={{ color: CL.ink2, marginBottom: 2, lineHeight: 1.4 }}>
              {l}
            </Text>
          ))}
        </View>
      ) : null}

      {!slim && data.highlights?.length ? (
        <View>
          <Text style={styles.sidebarLabel}>Recognition</Text>
          {data.highlights.map((h, i) => (
            <Text key={i} style={{ color: CL.ink2, marginBottom: 4, lineHeight: 1.45 }}>
              {h}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function MainHeader({ data }: { data: ResumeJson }) {
  return (
    <View style={styles.headerWrap}>
      <Text style={styles.name}>{data.contact.name}</Text>
      {data.contact.title ? <Text style={styles.roleEyebrow}>{data.contact.title}</Text> : null}
      <View style={styles.headerRule} />
    </View>
  );
}

function Job({ job }: { job: ResumeJson['experience'][number] }) {
  return (
    <View style={styles.jobWrap} wrap={false}>
      <View style={styles.jobRow}>
        <Text style={styles.jobTitle}>{job.title}</Text>
        <Text style={styles.jobDates}>{renderDateRange(job)}</Text>
      </View>
      <Text style={styles.jobMeta}>
        <Text style={styles.jobMetaCompany}>{job.company}</Text>
        {job.location ? <Text style={styles.jobMetaLoc}> · {job.location}</Text> : null}
      </Text>
      {job.bullets?.map((b, i) => (
        <View key={i} style={styles.bullet}>
          <Text style={styles.bulletDot}>·</Text>
          <Text style={styles.bulletText}>{b}</Text>
        </View>
      ))}
    </View>
  );
}

interface ClassicResumeProps {
  data: ResumeJson;
}

export function ClassicResume({ data }: ClassicResumeProps) {
  const isMulti = (data.experience?.length ?? 0) >= 4;
  const splitAt = 3;
  const p1 = isMulti ? data.experience.slice(0, splitAt) : data.experience;
  const p2 = isMulti ? data.experience.slice(splitAt) : [];

  return (
    <Document title={`${data.contact.name} — Résumé`} author={data.contact.name}>
      <Page size="LETTER" style={styles.page}>
        <Sidebar data={data} />
        <View style={styles.main}>
          <MainHeader data={data} />
          {data.summary ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Professional Summary</Text>
              <Text style={styles.summary}>{data.summary}</Text>
            </View>
          ) : null}
          {p1.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Professional Experience</Text>
              {p1.map((j, i) => (
                <Job key={i} job={j} />
              ))}
            </View>
          ) : null}
          {isMulti ? <Text style={styles.pageMark}>Page 1 of 2</Text> : null}
        </View>
      </Page>

      {isMulti ? (
        <Page size="LETTER" style={styles.page}>
          <Sidebar data={data} slim />
          <View style={styles.main}>
            <View style={styles.continuationHeader}>
              <Text style={styles.continuationName}>{data.contact.name}</Text>
              <Text style={styles.continuationPage}>Page 2 of 2</Text>
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Experience, continued</Text>
              {p2.map((j, i) => (
                <Job key={i} job={j} />
              ))}
            </View>
          </View>
        </Page>
      ) : null}
    </Document>
  );
}
