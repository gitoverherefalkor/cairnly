// ATS Classic template — serif headings, traditional structure, single column.
// Plain text layer so résumé parsers can read every field.
//
// Designed to be the safest possible template for ATS scanning: no icons,
// no columns, no fancy typography. Use this when you're applying through
// portals that you suspect screen with software.

import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ResumeJson } from '../types';
import { realCertifications, renderDateRange } from './utils';

// Use Times Roman (built-in to react-pdf) so we don't need to register a
// custom font for this template. Trade-off: no italics for company location.
const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 40,
    paddingHorizontal: 56,
    fontFamily: 'Times-Roman',
    fontSize: 10.5,
    color: '#1a1a1a',
    lineHeight: 1.4,
  },
  name: {
    fontFamily: 'Times-Bold',
    fontSize: 22,
    textAlign: 'center',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  title: {
    fontSize: 11.5,
    textAlign: 'center',
    fontStyle: 'italic',
    color: '#444',
    marginBottom: 8,
  },
  contactLine: {
    fontSize: 9.5,
    textAlign: 'center',
    color: '#444',
    marginBottom: 16,
  },
  sectionHeading: {
    fontFamily: 'Times-Bold',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    paddingBottom: 3,
    marginTop: 16,
    marginBottom: 8,
  },
  summary: {
    fontSize: 10.5,
    lineHeight: 1.5,
  },
  experienceItem: {
    marginBottom: 10,
  },
  experienceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  experienceTitle: {
    fontFamily: 'Times-Bold',
    fontSize: 11,
  },
  experienceDates: {
    fontSize: 10,
    color: '#555',
  },
  experienceCompany: {
    fontStyle: 'italic',
    fontSize: 10.5,
    marginBottom: 4,
  },
  bullet: {
    flexDirection: 'row',
    marginBottom: 2,
    paddingLeft: 8,
  },
  bulletDot: {
    width: 10,
  },
  bulletText: {
    flex: 1,
    fontSize: 10.5,
    lineHeight: 1.4,
  },
  educationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  educationLeft: {
    flex: 1,
  },
  educationInstitution: {
    fontFamily: 'Times-Bold',
    fontSize: 11,
  },
  educationDegree: {
    fontSize: 10.5,
    fontStyle: 'italic',
  },
  educationDates: {
    fontSize: 10,
    color: '#555',
  },
  skillsRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  skillsLabel: {
    fontFamily: 'Times-Bold',
    fontSize: 10.5,
    width: 88,
  },
  skillsValue: {
    flex: 1,
    fontSize: 10.5,
  },
  certificationItem: {
    fontSize: 10.5,
    marginBottom: 2,
  },
});

interface AtsClassicProps {
  data: ResumeJson;
}

export function AtsClassic({ data }: AtsClassicProps) {
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
        <Text style={styles.name}>{data.contact.name}</Text>
        {data.contact.title ? <Text style={styles.title}>{data.contact.title}</Text> : null}
        {contactParts.length > 0 ? (
          <Text style={styles.contactLine}>{contactParts.join('  ·  ')}</Text>
        ) : null}

        {data.summary ? (
          <View>
            <Text style={styles.sectionHeading}>Professional Summary</Text>
            <Text style={styles.summary}>{data.summary}</Text>
          </View>
        ) : null}

        {data.experience?.length > 0 ? (
          <View>
            <Text style={styles.sectionHeading}>Experience</Text>
            {data.experience.map((exp, i) => (
              <View key={i} style={styles.experienceItem} wrap={false}>
                <View style={styles.experienceHeader}>
                  <Text style={styles.experienceTitle}>{exp.title}</Text>
                  <Text style={styles.experienceDates}>{renderDateRange(exp)}</Text>
                </View>
                <Text style={styles.experienceCompany}>
                  {[exp.company, exp.location].filter(Boolean).join(' · ')}
                </Text>
                {exp.bullets?.map((b, j) => (
                  <View key={j} style={styles.bullet}>
                    <Text style={styles.bulletDot}>•</Text>
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
            {data.skills_grouped.technical?.length ? (
              <View style={styles.skillsRow}>
                <Text style={styles.skillsLabel}>Technical:</Text>
                <Text style={styles.skillsValue}>{data.skills_grouped.technical.join(', ')}</Text>
              </View>
            ) : null}
            {data.skills_grouped.tools?.length ? (
              <View style={styles.skillsRow}>
                <Text style={styles.skillsLabel}>Tools:</Text>
                <Text style={styles.skillsValue}>{data.skills_grouped.tools.join(', ')}</Text>
              </View>
            ) : null}
            {data.skills_grouped.soft?.length ? (
              <View style={styles.skillsRow}>
                <Text style={styles.skillsLabel}>Strengths:</Text>
                <Text style={styles.skillsValue}>{data.skills_grouped.soft.join(', ')}</Text>
              </View>
            ) : null}
            {data.skills_grouped.languages?.length ? (
              <View style={styles.skillsRow}>
                <Text style={styles.skillsLabel}>Languages:</Text>
                <Text style={styles.skillsValue}>{data.skills_grouped.languages.join(', ')}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {data.education?.length > 0 ? (
          <View>
            <Text style={styles.sectionHeading}>Education</Text>
            {data.education.map((edu, i) => (
              <View key={i} style={styles.educationItem} wrap={false}>
                <View style={styles.educationLeft}>
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
