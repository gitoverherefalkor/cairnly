// ATS Modern template — sans-serif, generous spacing, subtle accent rule.
// Still ATS-safe: single column, no icons, plain text layer.

import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ResumeJson } from '../types';
import { realCertifications, renderDateRange } from './utils';

// Helvetica is built into react-pdf, so no Font.register() needed.
const ACCENT = '#27A1A1'; // atlas-teal — accent rule under name + section dividers.

const styles = StyleSheet.create({
  page: {
    paddingTop: 60,
    paddingBottom: 48,
    paddingHorizontal: 52,
    fontFamily: 'Helvetica',
    fontSize: 10.5,
    color: '#202020',
    lineHeight: 1.45,
  },
  header: {
    marginBottom: 22,
  },
  name: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 24,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  // Title sits under the name. Softer dark-grey instead of full teal —
  // the teal was overpowering the name on long, multi-line titles.
  title: {
    fontSize: 11,
    color: '#3d4a52',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    letterSpacing: 0.8,
    lineHeight: 1.35,
  },
  accentRule: {
    height: 2,
    width: 44,
    backgroundColor: ACCENT,
    marginBottom: 8,
  },
  contactLine: {
    fontSize: 9.5,
    color: '#666',
    lineHeight: 1.5,
  },
  sectionHeading: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: ACCENT,
    marginTop: 16,
    marginBottom: 4,
  },
  sectionRule: {
    height: 0.7,
    backgroundColor: '#ddd',
    marginBottom: 10,
  },
  summary: {
    fontSize: 10.5,
    lineHeight: 1.55,
    color: '#333',
  },
  experienceItem: {
    marginBottom: 12,
  },
  experienceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 1,
  },
  experienceTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
  },
  experienceDates: {
    fontSize: 9.5,
    color: '#666',
  },
  experienceCompany: {
    fontSize: 10.5,
    color: '#444',
    marginBottom: 5,
  },
  bullet: {
    flexDirection: 'row',
    marginBottom: 3,
    paddingLeft: 4,
  },
  bulletDot: {
    width: 10,
    color: ACCENT,
  },
  bulletText: {
    flex: 1,
    fontSize: 10.5,
    lineHeight: 1.45,
  },
  educationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  educationInstitution: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
  },
  educationDegree: {
    fontSize: 10.5,
    color: '#444',
  },
  educationDates: {
    fontSize: 9.5,
    color: '#666',
  },
  skillsRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  skillsLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    width: 84,
    color: ACCENT,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  skillsValue: {
    flex: 1,
    fontSize: 10.5,
  },
  certificationItem: {
    fontSize: 10.5,
    marginBottom: 3,
  },
});

interface AtsModernProps {
  data: ResumeJson;
}

export function AtsModern({ data }: AtsModernProps) {
  const contactParts = [
    data.contact.email,
    data.contact.phone,
    data.contact.location,
    data.contact.linkedin,
    data.contact.portfolio,
  ].filter(Boolean);

  return (
    <Document title={`${data.contact.name} — Résumé`} author={data.contact.name}>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.name}>{data.contact.name}</Text>
          {data.contact.title ? <Text style={styles.title}>{data.contact.title}</Text> : null}
          <View style={styles.accentRule} />
          {contactParts.length > 0 ? (
            <Text style={styles.contactLine}>{contactParts.join('   ·   ')}</Text>
          ) : null}
        </View>

        {data.summary ? (
          <View>
            <Text style={styles.sectionHeading}>Summary</Text>
            <View style={styles.sectionRule} />
            <Text style={styles.summary}>{data.summary}</Text>
          </View>
        ) : null}

        {data.experience?.length > 0 ? (
          <View>
            <Text style={styles.sectionHeading}>Experience</Text>
            <View style={styles.sectionRule} />
            {/* Pure natural flow: no wrap={false} anywhere. Heading, job
                headers, and bullets can each land where they fit. Mirrors
                how Word / Pages / Google Docs handle long résumés. */}
            {data.experience.map((exp, i) => (
              <View key={i} style={styles.experienceItem}>
                <View style={styles.experienceHeader}>
                  <Text style={styles.experienceTitle}>{exp.title}</Text>
                  <Text style={styles.experienceDates}>{renderDateRange(exp)}</Text>
                </View>
                <Text style={styles.experienceCompany}>
                  {[exp.company, exp.location].filter(Boolean).join(' · ')}
                </Text>
                {exp.bullets?.map((b, j) => (
                  <View key={j} style={styles.bullet}>
                    <Text style={styles.bulletDot}>›</Text>
                    <Text style={styles.bulletText}>{b}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        {(data.skills_grouped.technical?.length ||
          data.skills_grouped.tools?.length ||
          data.skills_grouped.soft?.length ||
          data.skills_grouped.languages?.length) ? (
          <View>
            <Text style={styles.sectionHeading}>Skills</Text>
            <View style={styles.sectionRule} />
            {data.skills_grouped.technical?.length ? (
              <View style={styles.skillsRow}>
                <Text style={styles.skillsLabel}>Technical</Text>
                <Text style={styles.skillsValue}>{data.skills_grouped.technical.join(', ')}</Text>
              </View>
            ) : null}
            {data.skills_grouped.tools?.length ? (
              <View style={styles.skillsRow}>
                <Text style={styles.skillsLabel}>Tools</Text>
                <Text style={styles.skillsValue}>{data.skills_grouped.tools.join(', ')}</Text>
              </View>
            ) : null}
            {data.skills_grouped.soft?.length ? (
              <View style={styles.skillsRow}>
                <Text style={styles.skillsLabel}>Strengths</Text>
                <Text style={styles.skillsValue}>{data.skills_grouped.soft.join(', ')}</Text>
              </View>
            ) : null}
            {data.skills_grouped.languages?.length ? (
              <View style={styles.skillsRow}>
                <Text style={styles.skillsLabel}>Languages</Text>
                <Text style={styles.skillsValue}>{data.skills_grouped.languages.join(', ')}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {data.education?.length > 0 ? (
          <View>
            <Text style={styles.sectionHeading}>Education</Text>
            <View style={styles.sectionRule} />
            {data.education.map((edu, i) => (
              <View key={i} style={styles.educationItem} wrap={false}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.educationInstitution}>{edu.institution}</Text>
                  <Text style={styles.educationDegree}>
                    {[edu.degree, edu.field].filter(Boolean).join(', ')}
                    {edu.location ? `  ·  ${edu.location}` : ''}
                  </Text>
                </View>
                <Text style={styles.educationDates}>{renderDateRange(edu)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {(() => {
          const real = realCertifications(data.certifications);
          if (real.length === 0) return null;
          return (
            <View>
              <Text style={styles.sectionHeading}>Certifications</Text>
              <View style={styles.sectionRule} />
              {real.map((cert, i) => (
                <Text key={i} style={styles.certificationItem}>
                  {cert.name}
                  {cert.issuer ? ` — ${cert.issuer}` : ''}
                  {cert.year ? ` (${cert.year})` : ''}
                </Text>
              ))}
            </View>
          );
        })()}
      </Page>
    </Document>
  );
}
