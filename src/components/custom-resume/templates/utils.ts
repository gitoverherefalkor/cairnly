// Shared template utilities.

interface DateRangeable {
  start?: string;
  end?: string;
  current?: boolean;
}

export function renderDateRange(item: DateRangeable): string {
  const start = item.start?.trim() || '';
  if (item.current) {
    return start ? `${start} — Present` : 'Present';
  }
  const end = item.end?.trim() || '';
  if (start && end) return `${start} — ${end}`;
  return start || end || '';
}

interface CertLike {
  name?: string;
  issuer?: string;
  year?: string;
}

// Strip half-empty certification rows. The LLM sometimes emits a stub with
// just a name and no issuer/year when the candidate has none on file —
// renders as a heading with one bare line and looks broken. We treat a cert
// as "real" only if it has a name AND at least an issuer or a year.
export function realCertifications<T extends CertLike>(items?: T[] | null): T[] {
  return (items || []).filter(
    (c) => (c.name || '').trim() && ((c.issuer || '').trim() || (c.year || '').trim()),
  );
}
