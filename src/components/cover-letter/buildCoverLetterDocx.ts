// Builds a .docx blob from the same CoverLetterJson + contact block the PDF
// uses. The visual hierarchy mirrors CoverLetter.tsx (header with name +
// contact line, then greeting / paragraphs / closing / signature) so the
// downloaded Word doc reads like the on-screen preview.
//
// `docx` is the de-facto JS library for Microsoft Word format. The output
// opens cleanly in Word, Pages, LibreOffice, and Google Docs (Drive auto-
// converts on upload).

import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';
import type { CoverLetterJson, ResumeContact } from '@/components/custom-resume/types';

export async function buildCoverLetterDocxBlob(
  letter: CoverLetterJson,
  contact: ResumeContact,
): Promise<Blob> {
  const contactLine = [contact.email, contact.phone, contact.location, contact.linkedin]
    .filter(Boolean)
    .join('   ·   ');

  const para = (text: string, opts: { bold?: boolean; size?: number; spacingAfter?: number } = {}) =>
    new Paragraph({
      spacing: { after: opts.spacingAfter ?? 240 },
      children: [
        new TextRun({
          text,
          bold: opts.bold,
          size: opts.size ?? 22, // half-points; 22 = 11pt body
          font: 'Calibri',
        }),
      ],
    });

  const doc = new Document({
    creator: contact.name || 'Cairnly',
    title: `${contact.name || 'Cover Letter'} — Cover Letter`,
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1080, bottom: 1080, left: 1440, right: 1440 }, // twips: ~0.75" top/bottom, 1" sides
          },
        },
        children: [
          // Name header
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: contact.name || '',
                bold: true,
                size: 36, // 18pt
                font: 'Calibri',
              }),
            ],
          }),
          // Contact line (subtle, small)
          ...(contactLine
            ? [
                new Paragraph({
                  spacing: { after: 480 },
                  children: [
                    new TextRun({
                      text: contactLine,
                      size: 19, // ~9.5pt
                      color: '666666',
                      font: 'Calibri',
                    }),
                  ],
                }),
              ]
            : [new Paragraph({ spacing: { after: 480 }, children: [] })]),

          // Greeting
          para(letter.greeting || 'Dear Hiring Team,'),
          // Opening
          para(letter.opening || ''),
          // Body paragraphs
          ...(letter.body_paragraphs ?? []).map((p) => para(p)),
          // Closing
          para(letter.closing || '', { spacingAfter: 480 }),
          // Signature
          new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [
              new TextRun({
                text: contact.name || '',
                bold: true,
                size: 22,
                font: 'Calibri',
              }),
            ],
          }),
        ],
      },
    ],
  });

  // Packer.toBlob() is browser-friendly; toBuffer() is Node-only.
  return await Packer.toBlob(doc);
}
