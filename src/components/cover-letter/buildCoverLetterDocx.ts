// Builds a .docx blob from the same CoverLetterJson + contact block the PDF
// uses. The visual hierarchy mirrors CoverLetter.tsx (header with name +
// contact line, then greeting / paragraphs / closing / signature) so the
// downloaded Word doc reads like the on-screen preview.
//
// `docx` is the de-facto JS library for Microsoft Word format. The output
// opens cleanly in Word, Pages, LibreOffice, and Google Docs (Drive auto-
// converts on upload).

import { Document, Packer, Paragraph, TextRun, AlignmentType, PageOrientation } from 'docx';
import type { CoverLetterJson, ResumeContact } from '@/components/custom-resume/types';

// Page geometry — A4 with European default margins.
//
// docx units are "twips" (twentieths of a point). 1 inch = 1440 twips,
// 1 cm ≈ 567 twips.
//
// A4 portrait: 210 × 297 mm → 11906 × 16838 twips.
// Margins: 3 cm top (extra breathing room above the name header so the
// letter doesn't sit jammed at the top of the page), 2.5 cm on the other
// three sides — the standard European Word/LibreOffice default for A4.
const A4_WIDTH_TWIPS = 11906;
const A4_HEIGHT_TWIPS = 16838;
const MARGIN_TOP = 1701;    // 3.0 cm
const MARGIN_SIDE = 1417;   // 2.5 cm
const MARGIN_BOTTOM = 1417; // 2.5 cm

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
            size: {
              width: A4_WIDTH_TWIPS,
              height: A4_HEIGHT_TWIPS,
              orientation: PageOrientation.PORTRAIT,
            },
            margin: {
              top: MARGIN_TOP,
              bottom: MARGIN_BOTTOM,
              left: MARGIN_SIDE,
              right: MARGIN_SIDE,
            },
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
