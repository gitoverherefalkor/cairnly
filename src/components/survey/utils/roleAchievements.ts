/**
 * Per-role achievement resolution for the skills_achievements question.
 *
 * The Achievements sub-editor shows one textarea per career role, but the
 * stored value is a flat `CompanyAchievement[]`. The original code matched a
 * role to its achievement by company NAME alone (`a.company === companyName`),
 * which collapses when a person has two roles at the SAME company: both boxes
 * bound to the one entry, so they showed identical CV-prefilled text and edits
 * to one changed the other. ~1/3 of real submissions have same-company roles.
 *
 * Fix: identify a role's achievement by (company, occurrence-index) — the Nth
 * role at a given company maps to the Nth stored entry for that company. This
 * keeps the `{company, yearRange, text}[]` shape n8n already consumes (it just
 * passes the array through), while letting every role hold its own text.
 *
 * Pre-filled data groups achievements by company (one entry per company), so
 * the CV text lands on the FIRST role at that company and later same-company
 * roles start empty — the "unique input per role" the user asked for.
 */

export interface RoleSlot {
  /** The role's company name (already filtered to non-empty by the caller). */
  company: string;
  /** Display-only year range, e.g. "2018–2020" or "2020–Present". */
  yearRange: string;
}

export interface CompanyAchievement {
  company: string;
  yearRange: string;
  text: string;
}

const norm = (s: string | undefined | null): string => (s ?? '').trim().toLowerCase();

/**
 * Returns the achievement text to display for each role slot, aligned to the
 * `roles` array order. The Nth role at a company consumes the Nth stored entry
 * for that company (case-insensitive); if none exists the slot resolves to ''.
 */
export function resolveRoleAchievementTexts(
  roles: RoleSlot[],
  stored: CompanyAchievement[],
): string[] {
  const occurrence = new Map<string, number>();
  return roles.map((role) => {
    const key = norm(role.company);
    const want = occurrence.get(key) ?? 0;
    occurrence.set(key, want + 1);

    let seen = 0;
    for (const entry of stored) {
      if (norm(entry.company) === key) {
        if (seen === want) return entry.text ?? '';
        seen += 1;
      }
    }
    return '';
  });
}

/**
 * Rebuild the full achievements array from the current roles + stored data.
 * Emits exactly one entry per role (in role order, including empty-text roles so
 * the occurrence mapping stays stable across re-renders), then preserves the
 * "Other" bucket and any orphaned entries (companies no longer in the role list).
 */
function serialize(
  roles: RoleSlot[],
  texts: string[],
  stored: CompanyAchievement[],
): CompanyAchievement[] {
  const roleEntries: CompanyAchievement[] = roles.map((role, i) => ({
    company: role.company,
    yearRange: role.yearRange,
    text: texts[i] ?? '',
  }));

  const roleCompanies = new Set(roles.map((r) => norm(r.company)));
  // Keep "Other" and any entry whose company isn't a current role, so switching
  // roles around in the previous question never silently drops saved text.
  const preserved = stored.filter((entry) => {
    const key = norm(entry.company);
    return key === 'other' || !roleCompanies.has(key);
  });

  return [...roleEntries, ...preserved];
}

/**
 * Apply an edit to the achievement text of a single role (by its index in the
 * `roles` array) and return the new full achievements array. Only that role's
 * entry changes; every other role and the Other bucket are preserved.
 */
export function applyRoleAchievementEdit(
  roles: RoleSlot[],
  stored: CompanyAchievement[],
  roleIndex: number,
  newText: string,
): CompanyAchievement[] {
  const texts = resolveRoleAchievementTexts(roles, stored);
  if (roleIndex >= 0 && roleIndex < texts.length) {
    texts[roleIndex] = newText;
  }
  return serialize(roles, texts, stored);
}

/**
 * Apply an edit to the "Other Achievements" bucket (not tied to any role) and
 * return the new full achievements array. Role entries are rebuilt (stable) and
 * the Other entry is set/cleared based on whether the text is non-empty.
 */
export function applyOtherAchievementEdit(
  roles: RoleSlot[],
  stored: CompanyAchievement[],
  newText: string,
): CompanyAchievement[] {
  const texts = resolveRoleAchievementTexts(roles, stored);
  const roleEntries: CompanyAchievement[] = roles.map((role, i) => ({
    company: role.company,
    yearRange: role.yearRange,
    text: texts[i] ?? '',
  }));

  const roleCompanies = new Set(roles.map((r) => norm(r.company)));
  // Orphans only — the Other entry is rewritten from newText below.
  const orphans = stored.filter((entry) => {
    const key = norm(entry.company);
    return key !== 'other' && !roleCompanies.has(key);
  });

  const other: CompanyAchievement[] = newText.trim()
    ? [{ company: 'Other', yearRange: '', text: newText }]
    : [];

  return [...roleEntries, ...orphans, ...other];
}

/** Read the current "Other Achievements" text out of a stored array. */
export function getOtherAchievementText(stored: CompanyAchievement[]): string {
  return stored.find((a) => norm(a.company) === 'other')?.text ?? '';
}
