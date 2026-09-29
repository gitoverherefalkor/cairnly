// The coach after the report (WF5C). A follow-up thread, separate from the
// first chat: it can read the whole finished report but never changes it.
// Spec: docs/superpowers/specs/2026-09-15-jobs-cap-chat-continuation-dismiss-design.md
//
// URL params (built by coachUrl in useCoach):
//   entry   which button opened the coach (career | move | set_aside | checkin)
//   context the career title or next-step text that button was about
//   ask     sent as the first message automatically (one-click questions)
//   draft   only pre-fills the input

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, Loader2, Send, CheckCircle2, X, Route as RouteIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useReports } from '@/hooks/useReports';
import { useQueryClient } from '@tanstack/react-query';
import { useN8nWebhook, CoachLimitError } from '@/hooks/useN8nWebhook';
import {
  useCoachAccess,
  useCoachNextSteps,
  coachSessionId,
  COACH_MONTHLY_LIMIT,
  type CoachEntryPoint,
} from '@/hooks/useCoach';
import { Button } from '@/components/ui/button';

interface CoachMessage {
  id: string;
  sender: 'user' | 'bot';
  content: string;
  local?: boolean; // opener bubbles shown but never stored or sent
}

const ENTRY_POINTS: CoachEntryPoint[] = ['chat', 'career', 'move', 'set_aside', 'checkin'];
const NOTICE_KEY = 'coach_memory_notice_seen';

const Coach: React.FC = () => {
  const { t, i18n } = useTranslation('coach');
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();
  const { profile } = useProfile();
  const { reports, isLoading: reportsLoading } = useReports();
  const report = reports[0];
  const reportId = report?.id;
  const access = useCoachAccess(reportId);
  const nextSteps = useCoachNextSteps(reportId);
  const { sendCoachMessage } = useN8nWebhook();

  const entryParam = params.get('entry') as CoachEntryPoint | null;
  const entry: CoachEntryPoint = entryParam && ENTRY_POINTS.includes(entryParam) ? entryParam : 'chat';
  const context = params.get('context') ?? '';

  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [input, setInput] = useState(params.get('draft') ?? '');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitResetsAt, setLimitResetsAt] = useState<string | null>(null);
  const [showNotice, setShowNotice] = useState(() => {
    try {
      return localStorage.getItem(NOTICE_KEY) !== '1';
    } catch {
      return true;
    }
  });
  const autoAskDone = useRef(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [authLoading, user, navigate]);

  // Coach off, or first chat not finished: back to the dashboard.
  useEffect(() => {
    if (!reportId || access.isLoading) return;
    if (!access.available) navigate('/dashboard', { replace: true });
  }, [reportId, access.isLoading, access.available, navigate]);

  // Load the coach thread (its own session, apart from the first chat).
  useEffect(() => {
    if (!reportId) return;
    let cancelled = false;
    supabase
      .from('chat_messages')
      .select('id, sender, content')
      .eq('session_id', coachSessionId(reportId))
      .order('created_at', { ascending: true })
      .then(({ data, error: loadErr }) => {
        if (cancelled) return;
        if (loadErr) console.error('coach history load failed:', loadErr);
        setMessages(((data ?? []) as CoachMessage[]).filter((m) => m.sender === 'user' || m.sender === 'bot'));
        setLoadingHistory(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  const firstName = profile?.first_name ?? '';

  // A local opener so the page never starts blank. Never stored or sent.
  const opener = useMemo<CoachMessage | null>(() => {
    if (entry === 'checkin' && context) {
      return { id: 'opener', sender: 'bot', local: true, content: t('opener.checkin', { step: context }) };
    }
    if (messages.length === 0) {
      return { id: 'opener', sender: 'bot', local: true, content: t('opener.default', { name: firstName }) };
    }
    return null;
  }, [entry, context, messages.length, firstName, t]);

  const persist = useCallback(
    async (sender: 'user' | 'bot', content: string) => {
      if (!reportId || !user) return;
      const { error: insErr } = await supabase.from('chat_messages').insert({
        session_id: coachSessionId(reportId),
        report_id: reportId,
        user_id: user.id,
        sender,
        content,
        metadata: sender === 'user' ? { coach: true, entry_point: entry } : { coach: true },
      });
      if (insErr) console.error('coach message persist failed:', insErr);
    },
    [reportId, user, entry],
  );

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || !reportId || sending || limitResetsAt) return;
      setError(null);
      setSending(true);
      setInput('');
      setMessages((prev) => [...prev, { id: `u-${Date.now()}`, sender: 'user', content: message }]);
      void persist('user', message);

      try {
        const { text: reply } = await sendCoachMessage(coachSessionId(reportId), message, {
          report_id: reportId,
          first_name: firstName,
          country: profile?.country ?? '',
          preferred_language: i18n.language,
          entry_point: entry,
          entry_context: context,
        });
        setMessages((prev) => [...prev, { id: `b-${Date.now()}`, sender: 'bot', content: reply }]);
        void persist('bot', reply);
        // The coach may have saved a next step; the counter moved by one.
        nextSteps.refresh();
        queryClient.invalidateQueries({ queryKey: ['coach-access'] });
      } catch (e) {
        if (e instanceof CoachLimitError) {
          setLimitResetsAt(e.resetsAt ?? '');
        } else {
          console.error('coach send failed:', e);
          setError(t('error.send'));
        }
      } finally {
        setSending(false);
        inputRef.current?.focus();
      }
    },
    [reportId, sending, limitResetsAt, persist, sendCoachMessage, firstName, profile?.country, i18n.language, entry, context, nextSteps, queryClient, t],
  );

  // One-click questions (e.g. the Move pill) arrive as ?ask= and are sent once.
  useEffect(() => {
    const ask = params.get('ask');
    if (!ask || autoAskDone.current || loadingHistory || !access.available || !reportId) return;
    autoAskDone.current = true;
    const next = new URLSearchParams(params);
    next.delete('ask');
    setParams(next, { replace: true });
    void send(ask);
  }, [params, setParams, loadingHistory, access.available, reportId, send]);

  const dismissNotice = () => {
    setShowNotice(false);
    try {
      localStorage.setItem(NOTICE_KEY, '1');
    } catch {
      // private mode: the notice just shows again next time
    }
  };

  const remaining = limitResetsAt !== null ? 0 : access.remaining;
  const resetLabel = (() => {
    const now = new Date();
    const d = limitResetsAt ? new Date(limitResetsAt) : new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return d.toLocaleDateString(i18n.language, { day: 'numeric', month: 'long' });
  })();

  if (authLoading || reportsLoading || access.isLoading || loadingHistory) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-atlas-teal" />
      </div>
    );
  }

  const shown = opener ? [opener, ...messages] : messages;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('header.back')}
          </button>
          <div className="text-center">
            <h1 className="font-heading font-semibold text-atlas-navy">{t('header.title')}</h1>
            <p className="text-xs text-gray-500">{t('header.subtitle')}</p>
          </div>
          <span className="text-xs font-medium text-gray-600 whitespace-nowrap" title={t('counter.tooltip', { date: resetLabel })}>
            {t('counter.left', { remaining, limit: COACH_MONTHLY_LIMIT })}
          </span>
        </div>
      </header>

      <div className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 grid gap-6 md:grid-cols-[1fr_260px]">
        <main className="flex flex-col min-h-[60vh]">
          {showNotice && (
            <div className="mb-4 rounded-lg border border-atlas-teal/30 bg-atlas-teal/5 p-4 text-sm text-gray-700 flex gap-3">
              <div className="flex-1">
                <p className="font-medium text-atlas-navy mb-1">{t('notice.title')}</p>
                <p>{t('notice.body')}</p>
              </div>
              <button type="button" onClick={dismissNotice} aria-label={t('notice.close')} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="flex-1 space-y-4">
            {shown.map((m) => (
              <div key={m.id} className={m.sender === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={
                    m.sender === 'user'
                      ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-atlas-teal text-white px-4 py-2.5 text-sm whitespace-pre-wrap'
                      : 'max-w-[85%] rounded-2xl rounded-bl-sm bg-white border border-gray-200 px-4 py-3 text-sm text-gray-800 prose prose-sm max-w-none'
                  }
                >
                  {m.sender === 'user' ? m.content : <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-white border border-gray-200 px-4 py-3 text-sm text-gray-500 inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('thinking')}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {messages.length === 0 && entry === 'chat' && !sending && (
            <div className="mt-4 flex flex-wrap gap-2">
              {(['plan', 'interview', 'doubt'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setInput(t(`starters.${k}`));
                    inputRef.current?.focus();
                  }}
                  className="rounded-full border border-atlas-teal text-atlas-teal px-3.5 py-1.5 text-sm hover:bg-atlas-teal hover:text-white transition-colors"
                >
                  {t(`starters.${k}`)}
                </button>
              ))}
            </div>
          )}

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          {limitResetsAt !== null ? (
            <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">
              <p className="font-medium text-atlas-navy mb-1">{t('limit.title')}</p>
              <p>{t('limit.body', { date: resetLabel })}</p>
            </div>
          ) : (
            <form
              className="mt-4 flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                rows={2}
                maxLength={4000}
                placeholder={t('input.placeholder')}
                className="flex-1 resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-atlas-teal"
                disabled={sending}
              />
              <Button type="submit" disabled={sending || !input.trim()} className="bg-atlas-teal hover:bg-atlas-teal/90">
                <Send className="h-4 w-4" />
                <span className="sr-only">{t('input.send')}</span>
              </Button>
            </form>
          )}
          <p className="mt-2 text-xs text-gray-400">{t('input.hint')}</p>
        </main>

        <aside className="order-first md:order-none">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-atlas-navy mb-2 inline-flex items-center gap-2">
              <RouteIcon className="h-4 w-4 text-atlas-teal" />
              {t('steps.title')}
            </h2>
            {nextSteps.steps.length === 0 ? (
              <p className="text-xs text-gray-500">{t('steps.empty')}</p>
            ) : (
              <ul className="space-y-3">
                {nextSteps.steps.map((s) => (
                  <li key={s.id} className={s.status === 'done' ? 'text-xs text-gray-400 line-through' : 'text-xs text-gray-700'}>
                    <p>{s.step}</p>
                    {s.status === 'open' && (
                      <div className="mt-1 flex items-center gap-3 text-[11px]">
                        <span className="text-gray-400">
                          {t('steps.checkin', {
                            date: new Date(s.check_in_at).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' }),
                          })}
                        </span>
                        <button
                          type="button"
                          onClick={() => nextSteps.setStatus({ id: s.id, status: 'done' })}
                          className="inline-flex items-center gap-1 text-atlas-teal hover:underline"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          {t('steps.done')}
                        </button>
                        <button
                          type="button"
                          onClick={() => nextSteps.setStatus({ id: s.id, status: 'dropped' })}
                          className="text-gray-400 hover:underline"
                        >
                          {t('steps.drop')}
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Coach;
