/**
 * Merges the two survey pre-fill sources: the resume upload
 * (`resume_parsed_data`) and the landing-page intake chat
 * (`intake_prefill_data`).
 *
 * Resume data wins per key (it is richer and more recent in the funnel),
 * but intake keys the resume lacks survive — notably `goals`, which the
 * resume extraction deliberately never produces. Empty resume values
 * (empty string / null / undefined) don't shadow intake values.
 */
export function mergePrefillSources(
  resumeData: Record<string, unknown> | null,
  intakeData: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!resumeData && !intakeData) return null;
  const merged: Record<string, unknown> = { ...(intakeData ?? {}) };
  Object.entries(resumeData ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      merged[key] = value;
    }
  });
  return merged;
}
