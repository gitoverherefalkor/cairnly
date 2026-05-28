/**
 * Locale-aware formatting helpers.
 *
 * Always pass i18n.language (e.g. via useTranslation()) — do NOT hardcode 'en-US'.
 * Falls back to en-US for any unsupported language code.
 */

const localeFor = (lang: string): string => {
  if (lang.startsWith("nl")) return "nl-NL";
  if (lang.startsWith("de")) return "de-DE";
  return "en-US";
};

export const formatDate = (
  date: Date | string | number,
  lang: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" }
): string => {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat(localeFor(lang), options).format(d);
};

export const formatCurrency = (
  amount: number,
  lang: string,
  currency?: string
): string => {
  const inferredCurrency = currency ?? (lang.startsWith("nl") || lang.startsWith("de") ? "EUR" : "USD");
  return new Intl.NumberFormat(localeFor(lang), {
    style: "currency",
    currency: inferredCurrency,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
};

export const formatNumber = (value: number, lang: string): string =>
  new Intl.NumberFormat(localeFor(lang)).format(value);
