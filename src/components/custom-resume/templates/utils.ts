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
