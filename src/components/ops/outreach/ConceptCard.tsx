// One concept in the cockpit, open and editable in place (no extra click).
//
// A first mail, chase or check-in shows its text with everything that differs
// from the approved skeleton highlighted, so the boilerplate can be skimmed.
// A reply shows their mail beside ours (stacked on a phone), with the words
// both share highlighted on both sides and any question of theirs that our
// answer does not touch flagged in red.
//
// Edits save themselves (debounced). Schedule and Send flush a pending save
// first, so what you see is what goes. Send waits 15 seconds for Undo, then
// knocks WF12.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Clock, Loader2, Send, Undo2, CalendarClock, Trash2, RefreshCw, PauseCircle, CheckCircle2, Sparkles } from 'lucide-react';
import { callOutreach } from './api';
import ConceptEditor from './ConceptEditor';
import HighlightedText from './HighlightedText';
import { SOORT_LABEL, type ConceptRow } from './types';
import {
  contentWords,
  diffAgainstSkeleton,
  questions,
  sharedSpans,
  unansweredQuestions,
  type Span,
} from '@/lib/outreachHighlight';

const SAVE_DEBOUNCE_MS = 800;

function fmtWhen(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Europe/Amsterdam',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const btn =
  'inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const BTN = {
  primary: `${btn} border-atlas-teal/50 bg-atlas-teal/15 text-atlas-teal hover:bg-atlas-teal/25`,
  send: `${btn} border-amber-500/50 text-amber-300 hover:bg-amber-500/10`,
  quiet: `${btn} border-white/[0.14] text-white/70 hover:text-white hover:bg-white/[0.06]`,
  danger: `${btn} border-red-500/30 text-red-300/90 hover:bg-red-500/10`,
};

export default function ConceptCard({
  concept,
  mode,
  estimate,
  onChanged,
}: {
  concept: ConceptRow;
  /** needs = waiting for Sjoerd; going = scheduled; sent = went out today. */
  mode: 'needs' | 'going' | 'sent';
  /** Estimated send moment for a scheduled concept. */
  estimate?: string | null;
  onChanged: () => void;
}) {
  const [body, setBody] = useState(concept.body);
  const [validatie, setValidatie] = useState(concept.validatie);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(mode === 'needs');
  const [countdown, setCountdown] = useState<number | null>(null);
  const dirty = useRef(false);
  const timer = useRef<number | null>(null);

  // A fresh list from the server replaces local text only when we have no
  // unsaved edit of our own.
  useEffect(() => {
    if (!dirty.current) {
      setBody(concept.body);
      setValidatie(concept.validatie);
    }
  }, [concept.body, concept.validatie]);

  const save = useCallback(async (text: string) => {
    setSaving('saving');
    try {
      const res = await callOutreach<{ validatie: ConceptRow['validatie'] }>({ action: 'concept_update', id: concept.id, body: text });
      setValidatie(res.validatie);
      dirty.current = false;
      setSaving('saved');
    } catch (e) {
      setSaving('error');
      toast.error(e instanceof Error ? e.message : 'Could not save the edit');
      throw e;
    }
  }, [concept.id]);

  const onEdit = (text: string) => {
    setBody(text);
    dirty.current = true;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      save(text).catch(() => undefined);
    }, SAVE_DEBOUNCE_MS);
  };

  /** Make sure the server has what is on screen before approving it. */
  const flush = async () => {
    if (timer.current) window.clearTimeout(timer.current);
    if (dirty.current) await save(body);
  };

  const act = async (name: string, fn: () => Promise<void>) => {
    setBusy(name);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Could not ${name}`);
    } finally {
      setBusy(null);
    }
  };

  const schedule = () =>
    act('schedule', async () => {
      await flush();
      await callOutreach({ action: 'concept_schedule', id: concept.id });
      toast.success(concept.soort === 'reply' ? 'Reply scheduled, goes out within 20 minutes' : 'Scheduled for the next free slot');
      onChanged();
    });

  const sendNow = () =>
    act('send', async () => {
      await flush();
      const res = await callOutreach<{ niet_voor: string | null }>({ action: 'concept_send', id: concept.id });
      const left = res.niet_voor ? Math.max(1, Math.round((Date.parse(res.niet_voor) - Date.now()) / 1000)) : 15;
      setCountdown(left);
    });

  // Send's Undo window. When it runs out, knock WF12 so "now" means now.
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      callOutreach({ action: 'knock' })
        .then(() => toast.success('Sent to the queue, leaving now'))
        .catch(() => toast.message('Queued; the next minute tick sends it'))
        .finally(onChanged);
      return;
    }
    const t = window.setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [countdown, onChanged]);

  const undo = () =>
    act('undo', async () => {
      await callOutreach({ action: 'concept_unschedule', id: concept.id });
      setCountdown(null);
      toast.success('Stopped. The concept is waiting again.');
      onChanged();
    });

  const simple = (action: string, done: string) => () =>
    act(action, async () => {
      await callOutreach({ action, id: concept.id });
      toast.success(done);
      onChanged();
    });

  const park = () =>
    act('park', async () => {
      await callOutreach({ action: 'dismiss_reply', slug: concept.slug });
      await callOutreach({ action: 'concept_no_reply', id: concept.id });
      toast.success('Parked. A check-in comes up in 10 working days, or sooner if they write.');
      onChanged();
    });

  // ── Highlights ──
  const isReply = concept.soort === 'reply';
  const theirText = concept.answers?.body_text ?? concept.answers?.snippet ?? '';
  const snippetOnly = isReply && !concept.answers?.body_text;
  const theirWords = useMemo(() => contentWords(theirText), [theirText]);
  const ourWords = useMemo(() => contentWords(body), [body]);
  const editorSpans: Span[] = useMemo(() => {
    if (isReply) return sharedSpans(body, theirWords);
    if (concept.skeleton) return diffAgainstSkeleton(body, concept.skeleton);
    return [{ text: body, mark: 'none' }];
  }, [body, isReply, theirWords, concept.skeleton]);
  const theirSpans = useMemo(() => sharedSpans(theirText, ourWords), [theirText, ourWords]);
  const theirQuestions = useMemo(() => questions(theirText), [theirText]);
  const unanswered = useMemo(() => new Set(unansweredQuestions(theirText, body)), [theirText, body]);

  // ── Header facts ──
  const title = concept.naam ?? concept.slug;
  const kind = `${SOORT_LABEL[concept.soort]}${concept.soort === 'chase' && concept.step ? ` ${concept.step}` : ''}`;
  const dueAt = concept.basis?.dueAt ? Date.parse(concept.basis.dueAt) : null;
  const lateDays = dueAt ? Math.floor((Date.now() - dueAt) / 86_400_000) : null;
  const stale = concept.status === 'verouderd';
  const editable = mode !== 'sent';

  return (
    <div className={`rounded-2xl border ${stale ? 'border-amber-500/40' : 'border-white/[0.10]'} bg-white/[0.03] p-3 sm:p-4`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[11px] px-2 py-0.5 rounded-full border border-white/[0.16] text-white/80">{kind}</span>
        <button onClick={() => setOpen((v) => !v)} className="text-sm font-bold text-white hover:underline text-left">
          {title}
        </button>
        {concept.tier && <span className="text-[11px] text-white/50">tier {concept.tier}</span>}
        {isReply && concept.answers?.samenvatting && (
          <span className="text-xs text-white/60 truncate max-w-full">{concept.answers.samenvatting}</span>
        )}
        {mode === 'needs' && lateDays !== null && lateDays > 0 && concept.soort !== 'reply' && (
          <span className="text-[11px] text-amber-300">{lateDays === 1 ? '1 day late' : `${lateDays} days late`}</span>
        )}
        {mode === 'going' && (
          <span className="text-[11px] text-white/60 inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> ~{fmtWhen(estimate ?? concept.queue?.niet_voor ?? null)}
            {concept.goedgekeurd_door === 'auto' && (
              <span className="ml-1 px-1.5 rounded border border-atlas-teal/40 text-atlas-teal inline-flex items-center gap-0.5">
                <Sparkles className="h-2.5 w-2.5" /> auto
              </span>
            )}
          </span>
        )}
        {mode === 'sent' && (
          <span className="text-[11px] text-emerald-300 inline-flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> sent {fmtWhen(concept.verzonden_op)}
          </span>
        )}
        <span className="ml-auto text-[11px] text-white/40">
          {saving === 'saving' ? 'Saving…' : saving === 'saved' ? 'Saved' : saving === 'error' ? 'Not saved' : ''}
        </span>
      </div>

      {stale && (
        <div className="mt-2 text-xs text-amber-300 flex items-start gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>Out of date: {concept.verouderd_reden ?? 'something changed'}. Your text is kept.</span>
        </div>
      )}

      {open && (
        <div className="mt-3">
          <div className="text-[11px] text-white/50 mb-1.5">
            To {concept.to_email} · {concept.subject}
          </div>

          {isReply ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5">
                <div className="text-[11px] text-white/50 mb-1">
                  {concept.answers?.from_email ?? 'They'} wrote {fmtWhen(concept.answers?.sent_at ?? null)}
                  {snippetOnly && ' (snippet only, older mail)'}
                </div>
                <HighlightedText spans={theirSpans} className="text-[13px] leading-[1.6] text-white/85" />
                {theirQuestions.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {theirQuestions.map((q) => (
                      <li key={q} className={`text-xs flex gap-1.5 ${unanswered.has(q) ? 'text-red-300' : 'text-white/60'}`}>
                        {unanswered.has(q) ? <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> : <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
                        <span>{unanswered.has(q) ? `Not answered? ${q}` : q}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <ConceptEditor value={body} spans={editorSpans} onChange={onEdit} disabled={!editable} label={`Reply to ${title}`} />
            </div>
          ) : (
            <ConceptEditor value={body} spans={editorSpans} onChange={onEdit} disabled={!editable} label={`${kind} to ${title}`} />
          )}

          {!validatie.ok && validatie.problems.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {validatie.problems.map((p) => (
                <li key={p} className="text-[11px] text-amber-300/90 flex gap-1.5">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> {p}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {countdown !== null ? (
              <>
                <span className="text-xs text-amber-300 self-center">Sending in {countdown}s</span>
                <button className={BTN.quiet} onClick={undo} disabled={busy !== null}>
                  <Undo2 className="h-3.5 w-3.5" /> Undo
                </button>
              </>
            ) : mode === 'needs' ? (
              <>
                <button className={BTN.primary} onClick={schedule} disabled={busy !== null || !body.trim()}>
                  {busy === 'schedule' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="h-3.5 w-3.5" />}
                  {stale ? 'Schedule anyway' : 'Schedule'}
                </button>
                <button className={BTN.send} onClick={sendNow} disabled={busy !== null || !body.trim()}>
                  {busy === 'send' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send now
                </button>
                {isReply && (
                  <>
                    <button className={BTN.quiet} onClick={park} disabled={busy !== null}>
                      <PauseCircle className="h-3.5 w-3.5" /> Park: they'll get back to me
                    </button>
                    <button className={BTN.quiet} onClick={simple('concept_no_reply', 'Marked as needing no reply')} disabled={busy !== null}>
                      No reply needed
                    </button>
                  </>
                )}
                {!isReply && (
                  <button className={BTN.quiet} onClick={simple('concept_regenerate', 'Rewritten from today’s facts')} disabled={busy !== null}>
                    <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                  </button>
                )}
                <button className={BTN.danger} onClick={simple('concept_discard', 'Discarded')} disabled={busy !== null}>
                  <Trash2 className="h-3.5 w-3.5" /> Discard
                </button>
              </>
            ) : mode === 'going' ? (
              <button className={BTN.quiet} onClick={simple('concept_unschedule', 'Taken back. It waits for you again.')} disabled={busy !== null}>
                <Undo2 className="h-3.5 w-3.5" /> Unschedule
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
