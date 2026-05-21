// Strip HTML tags from a string. report_sections.title comes back as HTML
// like "<h3><strong>Product Manager</strong></h3>" — we need a clean plain
// label for buttons and the picker.
export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export function formatStatusLabel(
  status: 'processing' | 'completed' | 'failed' | string,
): string {
  switch (status) {
    case 'processing':
      return 'Tailoring…';
    case 'completed':
      return 'Ready';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
}
