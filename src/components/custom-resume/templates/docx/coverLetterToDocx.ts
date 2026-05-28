// Build an editable .docx version of a cover letter. Same beta logic as
// resumeToDocx: clean, single-column, easily editable in Word.

import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import type { CoverLetterJson, ResumeJson } from '../../types';

const FONT = 'Calibri';

function contactLine(contact: ResumeJson['contact']): string {
  return [contact.email, contact.phone, contact.location, contact.linkedin]
    .filter((p) => (p || '').trim())
    .join('   ·   ');
}

export async function buildCoverLetterDocxBlob(
  letter: CoverLetterJson,
  contact: ResumeJson['contact'],
  careerTitle: string,
): Promise<Blob> {
  const body: Paragraph[] = [];

  // Name + contact header
  body.push(
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({ text: contact?.name ?? 'Name', bold: true, size: 32, font: FONT }),
      ],
    }),
  );
  const cl = contactLine(contact);
  if (cl) {
    body.push(
      new Paragraph({
        spacing: { after: 320 },
        children: [
          new TextRun({ text: cl, size: 18, font: FONT, color: '555555' }),
        ],
      }),
    );
  }

  // Greeting
  body.push(
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({ text: letter.greeting ?? 'Dear Hiring Team,', size: 22, font: FONT }),
      ],
    }),
  );

  // Opening + body paragraphs + closing
  const paragraphs: string[] = [];
  if (letter.opening?.trim()) paragraphs.push(letter.opening.trim());
  for (const p of letter.body_paragraphs ?? []) {
    if ((p || '').trim()) paragraphs.push(p.trim());
  }
  if (letter.closing?.trim()) paragraphs.push(letter.closing.trim());

  for (const p of paragraphs) {
    body.push(
      new Paragraph({
        spacing: { after: 200 },
        children: [
          new TextRun({ text: p, size: 22, font: FONT, color: '202020' }),
        ],
      }),
    );
  }

  // Signature
  body.push(
    new Paragraph({
      spacing: { before: 240 },
      children: [
        new TextRun({ text: contact?.name ?? '', bold: true, size: 22, font: FONT }),
      ],
    }),
  );

  // Marker w/ target career for reference when the user is editing locally.
  body.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 400 },
      children: [
        new TextRun({
          text: `Tailored for: ${careerTitle}`,
          italics: true,
          size: 16,
          font: FONT,
          color: '888888',
        }),
      ],
    }),
  );

  const doc = new Document({
    creator: 'Cairnly',
    title: `${contact?.name ?? 'Cover Letter'} — ${careerTitle}`,
    styles: {
      default: {
        document: { run: { font: FONT } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1080, right: 1200, bottom: 1080, left: 1200 }, // ~0.75-0.85"
          },
        },
        children: body,
      },
    ],
  });

  return Packer.toBlob(doc);
}
