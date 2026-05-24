// Simple, formal cover letter PDF template. Matches the visual language of
// the ATS Modern résumé so a hiring manager opening both feels they came from
// the same person.

import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { CoverLetterJson, ResumeContact } from '../types';

const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 48,
    paddingHorizontal: 64,
    fontFamily: 'Helvetica',
    fontSize: 11,
    color: '#202020',
    lineHeight: 1.55,
  },
  header: {
    marginBottom: 32,
  },
  name: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 18,
    marginBottom: 2,
  },
  contact: {
    fontSize: 9.5,
    color: '#666',
  },
  greeting: {
    marginBottom: 14,
  },
  paragraph: {
    marginBottom: 12,
  },
  closing: {
    marginTop: 16,
  },
  signature: {
    marginTop: 24,
    fontFamily: 'Helvetica-Bold',
  },
});

interface CoverLetterProps {
  letter: CoverLetterJson;
  contact: ResumeContact;
  careerTitle: string;
}

export function CoverLetter({ letter, contact, careerTitle }: CoverLetterProps) {
  const contactLine = [contact.email, contact.phone, contact.location, contact.linkedin]
    .filter(Boolean)
    .join('   ·   ');

  return (
    <Document title={`${contact.name} — Cover Letter — ${careerTitle}`} author={contact.name}>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.name}>{contact.name}</Text>
          {contactLine ? <Text style={styles.contact}>{contactLine}</Text> : null}
        </View>

        <Text style={styles.greeting}>{letter.greeting}</Text>

        <Text style={styles.paragraph}>{letter.opening}</Text>
        {letter.body_paragraphs?.map((p, i) => (
          <Text key={i} style={styles.paragraph}>
            {p}
          </Text>
        ))}

        <Text style={styles.closing}>{letter.closing}</Text>
        <Text style={styles.signature}>{contact.name}</Text>
      </Page>
    </Document>
  );
}
