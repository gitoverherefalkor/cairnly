// Salary range for job cards: "54–72k", no currency (no currency in the schema).
//
// Scraped postings mix units. Dutch postings especially state a MONTHLY range
// (DHD: 5297–5757), which used to render as "5–6k" right next to yearly
// "54–72k" ranges. Anything below MONTHLY_CEILING can't be a yearly salary
// for these roles, so we read it as monthly and show the yearly equivalent
// (x12, excluding holiday pay / 13th month), keeping every card comparable.
// Values below HOURLY_CEILING are hourly rates; we don't guess hours, so those
// are hidden rather than shown as a misleading "0k".

const HOURLY_CEILING = 300;
const MONTHLY_CEILING = 15000;

function toYearly(n: number): number | null {
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n < HOURLY_CEILING) return null;
  if (n < MONTHLY_CEILING) return n * 12;
  return n;
}

export function formatSalaryRange(
  min: number | null | undefined,
  max: number | null | undefined,
): string {
  const lo = min != null ? toYearly(Number(min)) : null;
  const hi = max != null ? toYearly(Number(max)) : null;
  if (lo == null && hi == null) return '';
  const k = (n: number) => Math.round(n / 1000);
  if (lo != null && hi != null && k(hi) > k(lo)) return `${k(lo)}–${k(hi)}k`;
  return `${k((lo ?? hi) as number)}k`;
}
