// Build an editable .docx version of a tailored résumé.
//
// Trade-off: this is intentionally a SIMPLE, near-stock Word layout. The
// designed PDF templates use react-pdf primitives that don't map cleanly to
// Word styles (multi-column, custom fonts, absolute positioning). For a beta
// "let users edit the content" path, a clean single-column docx that opens in
// any version of Word / Pages / Google Docs is more valuable than a fragile
// pixel-perfect clone.

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TabStopPosition,
  TabStopType,
  TextRun,
} from 'docx';
import type { ResumeJson } from '../../types';
import { renderDateRange } from '../utils';

const COLOR = {
  ink: '111111',
  ink2: '333333',
  accent: '1F8282',
  rule: '1F2937',
} as const;

const FONT = 'Calibri';

function nameBlock(name: string, title?: string) {
  const lines: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: name,
          bold: true,
          size: 36, // half-points → 18pt
          font: FONT,
          color: COLOR.ink,
        }),
      ],
    }),
  ];
  if (title?.trim()) {
    lines.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: title,
            italics: true,
            size: 22,
            font: FONT,
            color: COLOR.ink2,
          }),
        ],
      }),
    );
  }
  return lines;
}

function contactBlock(contact: ResumeJson['contact']): Paragraph[] {
  const parts = [contact.email, contact.phone, contact.location, contact.linkedin, contact.portfolio]
    .filter((p) => (p || '').trim())
    .join('   ·   ');
  if (!parts) return [];
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({ text: parts, size: 18, font: FONT, color: COLOR.ink2 }),
      ],
    }),
  ];
}

function sectionHeading(label: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 80 },
    border: {
      bottom: { color: COLOR.rule, space: 4, style: BorderStyle.SINGLE, size: 6 },
    },
    children: [
      new TextRun({
        text: label.toUpperCase(),
        bold: true,
        size: 22,
        font: FONT,
        color: COLOR.ink,
        characterSpacing: 30,
      }),
    ],
  });
}

function paragraphText(text: string, opts: { size?: number; bold?: boolean; italics?: boolean; color?: string; before?: number; after?: number } = {}) {
  return new Paragraph({
    spacing: { before: opts.before ?? 0, after: opts.after ?? 40 },
    children: [
      new TextRun({
        text,
        bold: opts.bold,
        italics: opts.italics,
        color: opts.color ?? COLOR.ink2,
        size: opts.size ?? 22,
        font: FONT,
      }),
    ],
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 40 },
    children: [
      new TextRun({ text, size: 22, font: FONT, color: COLOR.ink2 }),
    ],
  });
}

// Title row: "Job Title" (left) + dates (right) with a tab stop. Reads well
// in Word's standard layout without absolute positioning.
function jobTitleRow(title: string, dates: string): Paragraph {
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    spacing: { before: 120, after: 20 },
    children: [
      new TextRun({ text: title, bold: true, size: 22, font: FONT, color: COLOR.ink }),
      new TextRun({ text: '\t' + dates, size: 22, font: FONT, color: COLOR.ink2 }),
    ],
  });
}

function jobMetaRow(company: string, location?: string): Paragraph {
  const meta = [company, location].filter(Boolean).join(' · ');
  return new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({ text: meta, italics: true, size: 22, font: FONT, color: COLOR.ink2 }),
    ],
  });
}

function buildResumeChildren(data: ResumeJson): Paragraph[] {
  const out: Paragraph[] = [];

  // Header
  out.push(...nameBlock(data.contact?.name ?? 'Name', data.contact?.title));
  out.push(...contactBlock(data.contact ?? ({} as ResumeJson['contact'])));

  // Summary
  if (data.summary?.trim()) {
    out.push(sectionHeading('Professional Summary'));
    out.push(paragraphText(data.summary.trim(), { after: 120 }));
  }

  // Experience
  if (data.experience?.length) {
    out.push(sectionHeading('Experience'));
    for (const job of data.experience) {
      const dates = renderDateRange(job);
      out.push(jobTitleRow(job.title ?? '', dates));
      out.push(jobMetaRow(job.company ?? '', job.location));
      for (const b of job.bullets ?? []) {
        if ((b || '').trim()) out.push(bullet(b));
      }
    }
  }

  // Skills (flat — Word users will reformat as they prefer)
  const sg = data.skills_grouped ?? ({} as ResumeJson['skills_grouped']);
  const skillRows: Array<[string, string[] | undefined]> = [
    ['Technical', sg.technical],
    ['Tools', sg.tools],
    ['Strengths', sg.soft],
    ['Languages', sg.languages],
  ];
  const hasAnySkill = skillRows.some(([, v]) => (v?.length ?? 0) > 0);
  if (hasAnySkill) {
    out.push(sectionHeading('Skills'));
    for (const [label, values] of skillRows) {
      if (!values?.length) continue;
      out.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({ text: `${label}: `, bold: true, size: 22, font: FONT, color: COLOR.ink }),
            new TextRun({ text: values.join(', '), size: 22, font: FONT, color: COLOR.ink2 }),
          ],
        }),
      );
    }
  }

  // Education
  if (data.education?.length) {
    out.push(sectionHeading('Education'));
    for (const ed of data.education) {
      const right = renderDateRange(ed);
      out.push(jobTitleRow(ed.institution ?? '', right));
      const degreeLine = [ed.degree, ed.field].filter(Boolean).join(', ');
      if (degreeLine) out.push(paragraphText(degreeLine, { italics: true }));
    }
  }

  // Certifications
  const realCerts = (data.certifications ?? []).filter(
    (c) => (c.name || '').trim() && ((c.issuer || '').trim() || (c.year || '').trim()),
  );
  if (realCerts.length) {
    out.push(sectionHeading('Certifications'));
    for (const c of realCerts) {
      const line = [c.name, c.issuer, c.year ? `(${c.year})` : null]
        .filter(Boolean)
        .join(' — ');
      out.push(paragraphText(line));
    }
  }

  // Highlights
  if (data.highlights?.length) {
    out.push(sectionHeading('Highlights'));
    for (const h of data.highlights) {
      if ((h || '').trim()) out.push(bullet(h));
    }
  }

  return out;
}

export async function buildResumeDocxBlob(data: ResumeJson): Promise<Blob> {
  const doc = new Document({
    creator: 'Cairnly',
    title: `${data.contact?.name ?? 'Résumé'} — Résumé`,
    styles: {
      default: {
        document: { run: { font: FONT } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720, // ~0.5"
              right: 1000,
              bottom: 720,
              left: 1000,
            },
          },
        },
        children: buildResumeChildren(data),
      },
    ],
  });

  // Packer.toBlob runs entirely client-side; no server hop, no extra cost.
  return Packer.toBlob(doc);
}
