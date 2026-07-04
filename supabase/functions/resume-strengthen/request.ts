import type { Decision } from './strength.ts';

export type StrengthenRequest =
  | { action: 'analyze'; custom_resume_id: string }
  | { action: 'apply'; custom_resume_id: string; decisions: Decision[] };

type ParseResult = { ok: true; value: StrengthenRequest } | { ok: false; error: string };

const MAX_DECISIONS = 10;

// deno-lint-ignore no-explicit-any
export function parseRequest(body: any): ParseResult {
  if (!body || typeof body.custom_resume_id !== 'string' || !body.custom_resume_id) {
    return { ok: false, error: 'custom_resume_id is required' };
  }
  if (body.action === 'analyze') {
    return { ok: true, value: { action: 'analyze', custom_resume_id: body.custom_resume_id } };
  }
  if (body.action === 'apply') {
    const ds = body.decisions;
    if (!Array.isArray(ds) || ds.length === 0) return { ok: false, error: 'decisions required' };
    if (ds.length > MAX_DECISIONS) return { ok: false, error: 'too many decisions' };
    for (const d of ds) {
      if (!d || typeof d.id !== 'string' || (d.action !== 'apply' && d.action !== 'skip')) {
        return { ok: false, error: 'invalid decision shape' };
      }
      if (d.user_input !== undefined && typeof d.user_input !== 'string') {
        return { ok: false, error: 'user_input must be a string' };
      }
    }
    const ids = ds.map((d: Decision) => d.id);
    if (new Set(ids).size !== ids.length) return { ok: false, error: 'duplicate decision ids' };
    return { ok: true, value: { action: 'apply', custom_resume_id: body.custom_resume_id, decisions: ds } };
  }
  return { ok: false, error: 'action must be analyze or apply' };
}
