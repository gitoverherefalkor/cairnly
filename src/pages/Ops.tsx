import React, { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, RefreshCw, ExternalLink, AlertTriangle, CheckCircle2, Minus, Image } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity = 'blocker' | 'needs-action' | 'fyi';
type Source = 'support' | 'n8n_error' | 'assessment_miss' | 'chapter_feedback';

interface ProviderStatus {
  indicator: 'none' | 'minor' | 'major' | 'critical';
  description: string;
  url: string;
  incidents: Array<{ name: string; impact: string; started_at: string }>;
}

interface OpsItem {
  key: string;
  source: Source;
  severity: Severity;
  summary: string;
  stage?: string;
  recommended_action?: string;
  analyzed_at: string;
  raw: Record<string, any>;
  upstream_flag?: boolean;
  screenshot_url?: string;
}

type Stage = 'signed_up' | 'survey' | 'processing' | 'report_ready' | 'in_chat' | 'done';

interface Person {
  user_id: string;
  first_name: string;
  country: string | null;
  stage: Stage;
  detail: string;
  signed_up_at: string;
  last_activity_at: string;
  has_resume: boolean;
}

interface OpsFeedResponse {
  provider_status: { claude: ProviderStatus | null; openai: ProviderStatus | null };
  items: OpsItem[];
  people: Person[];
  fetched_at: string;
  new_analyzed: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const ADMIN_EMAILS = new Set(['sjoerd@cairnly.io', 'sjoerd@falkoratlas.com']);

const SUPPORT_CATEGORIES: Record<string, string> = {
  access_code_payment: 'Access / payment',
  assessment_survey: 'Assessment / survey',
  ai_chat: 'AI chat',
  my_report: 'My report',
  job_openings: 'Job openings',
  account_login: 'Account / login',
  feature_idea: 'Feature idea',
  bug_report: 'Bug report',
  something_else: 'Something else',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function severityColor(s: Severity) {
  if (s === 'blocker') return 'bg-red-500/15 text-red-400 border-red-500/30';
  if (s === 'needs-action') return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  return 'bg-gray-500/15 text-gray-400 border-gray-500/30';
}

function severityLabel(s: Severity) {
  if (s === 'blocker') return '🔴 Blocker';
  if (s === 'needs-action') return '🟡 Needs action';
  return '⚪ FYI';
}

function sourceLabel(s: Source) {
  if (s === 'support') return 'Support';
  if (s === 'n8n_error') return 'n8n Error';
  if (s === 'assessment_miss') return 'Assessment miss';
  return 'Chat feedback';
}

function indicatorColor(i: string) {
  if (i === 'critical' || i === 'major') return 'text-red-400';
  if (i === 'minor') return 'text-amber-400';
  return 'text-emerald-400';
}

function indicatorDot(i: string) {
  if (i === 'critical' || i === 'major') return '🔴';
  if (i === 'minor') return '🟡';
  return '🟢';
}

function fmtDate(ts: string) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function getItemTs(item: OpsItem): string {
  return item.raw.created_at ?? item.raw.startedAt ?? item.raw.timestamp ?? '';
}

function timeAgo(ts: string): string {
  if (!ts) return '—';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const STAGE_META: Record<Stage, { label: string; color: string; order: number }> = {
  signed_up: { label: '①  Signed up', color: 'bg-gray-500/15 text-gray-300 border-gray-500/30', order: 0 },
  survey: { label: '②  Survey', color: 'bg-blue-500/15 text-blue-300 border-blue-500/30', order: 1 },
  processing: { label: '③  Processing', color: 'bg-purple-500/15 text-purple-300 border-purple-500/30', order: 2 },
  report_ready: { label: '④  Report ready', color: 'bg-teal-500/15 text-teal-300 border-teal-500/30', order: 3 },
  in_chat: { label: '⑤  In chat', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30', order: 4 },
  done: { label: '⑥  Done', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', order: 5 },
};

// Rough country → flag emoji. Falls back to a globe when unknown.
function countryFlag(country: string | null): string {
  if (!country) return '🌐';
  const map: Record<string, string> = {
    'United States': '🇺🇸', 'United Kingdom': '🇬🇧', Netherlands: '🇳🇱',
    Belgium: '🇧🇪', Germany: '🇩🇪', France: '🇫🇷', Spain: '🇪🇸',
    Italy: '🇮🇹', China: '🇨🇳', Estonia: '🇪🇪', Ireland: '🇮🇪',
    Canada: '🇨🇦', Australia: '🇦🇺', India: '🇮🇳', Portugal: '🇵🇹',
  };
  return map[country] ?? '🌐';
}

// ─── Provider status banner ───────────────────────────────────────────────────

function ProviderBanner({ status }: { status: OpsFeedResponse['provider_status'] }) {
  const providers = [
    { name: 'Claude (Anthropic)', data: status.claude, url: 'https://status.anthropic.com' },
    { name: 'OpenAI', data: status.openai, url: 'https://status.openai.com' },
  ];

  return (
    <Card className="border border-white/10 bg-white/5">
      <CardContent className="py-3 px-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Provider status
          </span>
          {providers.map(({ name, data, url }) => (
            <a
              key={name}
              href={data?.url ?? url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm hover:underline"
            >
              <span>{data ? indicatorDot(data.indicator) : '⚫'}</span>
              <span className={data ? indicatorColor(data.indicator) : 'text-gray-500'}>
                {name}
              </span>
              {data && data.indicator !== 'none' && (
                <span className="text-xs text-amber-400">— {data.description}</span>
              )}
              {!data && <span className="text-xs text-gray-600">— unreachable</span>}
              <ExternalLink size={11} className="text-gray-600" />
            </a>
          ))}
        </div>
        {/* Show active incidents if any */}
        {[status.claude, status.openai]
          .flatMap((s) => s?.incidents ?? [])
          .map((inc, i) => (
            <div key={i} className="mt-2 flex items-start gap-2 text-xs text-amber-400">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span>
                <strong>{inc.name}</strong> — {inc.impact} impact, started{' '}
                {fmtDate(inc.started_at)}
              </span>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}

// ─── Stats row ────────────────────────────────────────────────────────────────

function StatsRow({ items }: { items: OpsItem[] }) {
  const blockers = items.filter((i) => i.severity === 'blocker').length;
  const support = items.filter((i) => i.source === 'support').length;
  const n8n = items.filter((i) => i.source === 'n8n_error').length;
  const misses = items.filter((i) => i.source === 'assessment_miss').length;
  const feedback = items.filter((i) => i.source === 'chapter_feedback').length;

  const stat = (label: string, count: number, color: string) => (
    <div className={`rounded-lg border px-4 py-3 ${color}`}>
      <div className="text-2xl font-bold">{count}</div>
      <div className="text-xs text-gray-400 mt-0.5">{label}</div>
    </div>
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {stat('Blockers', blockers, blockers > 0 ? 'border-red-500/30 bg-red-500/10' : 'border-white/10 bg-white/5')}
      {stat('Support open', support, 'border-white/10 bg-white/5')}
      {stat('n8n errors', n8n, n8n > 0 ? 'border-amber-500/30 bg-amber-500/10' : 'border-white/10 bg-white/5')}
      {stat('Assessment misses', misses, 'border-white/10 bg-white/5')}
      {stat('Chat feedback', feedback, 'border-white/10 bg-white/5')}
    </div>
  );
}

// ─── Item card ────────────────────────────────────────────────────────────────

function ItemCard({ item }: { item: OpsItem }) {
  const [expanded, setExpanded] = useState(false);
  const [showScreenshot, setShowScreenshot] = useState(false);

  const ts = getItemTs(item);
  const raw = item.raw;

  // Title + metadata per source
  let title = item.summary;
  let meta: React.ReactNode = null;

  if (item.source === 'support') {
    const catLabel = SUPPORT_CATEGORIES[raw.category] ?? raw.category ?? 'Support';
    title = catLabel;
    meta = (
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 mt-1">
        <span>{raw.email ?? '—'}</span>
        {raw.page && <span className="font-mono truncate max-w-[200px]">{raw.page}</span>}
        {raw.access_code && <span>code: <span className="font-mono">{raw.access_code}</span></span>}
      </div>
    );
  }

  if (item.source === 'n8n_error') {
    title = raw.workflow_name ?? 'n8n Error';
    meta = (
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 mt-1">
        {raw.failed_node && <span>Node: <span className="font-mono">{raw.failed_node}</span></span>}
        {raw.id && <span className="font-mono">exec {raw.id}</span>}
      </div>
    );
  }

  if (item.source === 'assessment_miss') {
    const cat = String(raw.feedback_category ?? '');
    title = cat === '2' ? 'Major AI correction' : 'Minor AI refinement';
    meta = (
      <div className="text-xs text-gray-500 mt-1">
        Section: <span className="font-mono">{raw.section_type ?? '—'}</span>
      </div>
    );
  }

  if (item.source === 'chapter_feedback') {
    title = `Chapter feedback: ${raw.section_type?.replace('chapter_', '').replace('_feedback', '') ?? '?'}`;
    meta = null;
  }

  const bodyText =
    item.source === 'support'
      ? raw.message
      : item.source === 'n8n_error'
        ? raw.error_message
        : raw.feedback;

  return (
    <Card className={`border transition-all ${item.severity === 'blocker' ? 'border-red-500/40 bg-red-500/5' : item.severity === 'needs-action' ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/10 bg-white/5'}`}>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Badge
                variant="outline"
                className={`text-xs px-2 py-0.5 ${severityColor(item.severity)}`}
              >
                {severityLabel(item.severity)}
              </Badge>
              <Badge variant="outline" className="text-xs px-2 py-0.5 border-white/20 text-gray-400">
                {sourceLabel(item.source)}
              </Badge>
              {item.stage && item.stage !== 'unknown' && (
                <Badge variant="outline" className="text-xs px-2 py-0.5 border-white/10 text-gray-500">
                  {item.stage}
                </Badge>
              )}
              {item.upstream_flag && (
                <Badge variant="outline" className="text-xs px-2 py-0.5 border-amber-500/40 text-amber-400">
                  ⚠ Likely upstream
                </Badge>
              )}
            </div>
            <div className="font-medium text-gray-200 text-sm">{title}</div>
            {meta}
          </div>
          <div className="text-xs text-gray-600 whitespace-nowrap shrink-0">{fmtDate(ts)}</div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-3">
        {/* AI summary */}
        <div className="bg-white/5 rounded-lg px-3 py-2.5">
          <div className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">AI read</div>
          <div className="text-sm text-gray-200">{item.summary}</div>
          {item.recommended_action && (
            <div className="text-xs text-atlas-teal mt-1.5">→ {item.recommended_action}</div>
          )}
        </div>

        {/* Message / error body */}
        {bodyText && (
          <div>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              {expanded ? '▾ Hide detail' : '▸ Show detail'}
            </button>
            {expanded && (
              <div className="mt-2 text-sm text-gray-300 bg-black/20 rounded-lg px-3 py-2.5 whitespace-pre-wrap max-h-64 overflow-y-auto">
                {bodyText}
              </div>
            )}
          </div>
        )}

        {/* Screenshot */}
        {item.screenshot_url && (
          <div>
            <button
              onClick={() => setShowScreenshot((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              <Image size={12} />
              {showScreenshot ? 'Hide screenshot' : 'Show screenshot'}
            </button>
            {showScreenshot && (
              <a href={item.screenshot_url} target="_blank" rel="noopener noreferrer">
                <img
                  src={item.screenshot_url}
                  alt="Support screenshot"
                  className="mt-2 rounded-lg max-h-80 object-contain border border-white/10 cursor-zoom-in"
                />
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Feed list ────────────────────────────────────────────────────────────────

function Feed({ items }: { items: OpsItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-600">
        <CheckCircle2 size={32} className="mb-3 text-emerald-600" />
        <div className="text-sm">Nothing here</div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <ItemCard key={item.key} item={item} />
      ))}
    </div>
  );
}

// ─── People funnel ────────────────────────────────────────────────────────────

function PeoplePanel({ people }: { people: Person[] }) {
  if (people.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-600">
        <div className="text-sm">No signups in the last 30 days</div>
      </div>
    );
  }

  // Funnel counts per stage
  const counts = people.reduce<Record<string, number>>((acc, p) => {
    acc[p.stage] = (acc[p.stage] ?? 0) + 1;
    return acc;
  }, {});
  const stuck = people.filter(
    (p) => p.stage !== 'done' && Date.now() - new Date(p.last_activity_at).getTime() > 3 * 24 * 60 * 60 * 1000,
  ).length;

  return (
    <div className="space-y-4">
      {/* Funnel summary */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(STAGE_META) as Stage[]).map((stage) => (
          <div
            key={stage}
            className={`rounded-lg border px-3 py-2 text-xs ${STAGE_META[stage].color}`}
          >
            <span className="font-bold text-base mr-1.5">{counts[stage] ?? 0}</span>
            {STAGE_META[stage].label.replace(/^[①②③④⑤⑥]\s+/, '')}
          </div>
        ))}
      </div>

      {stuck > 0 && (
        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          <AlertTriangle size={13} />
          {stuck} {stuck === 1 ? 'person has' : 'people have'} been inactive 3+ days mid-journey — possible drop-off.
        </div>
      )}

      {/* People list */}
      <div className="space-y-2">
        {people.map((p) => {
          const isStuck =
            p.stage !== 'done' &&
            Date.now() - new Date(p.last_activity_at).getTime() > 3 * 24 * 60 * 60 * 1000;
          return (
            <div
              key={p.user_id}
              className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3"
            >
              <span className="text-xl shrink-0" title={p.country ?? 'Unknown country'}>
                {countryFlag(p.country)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-200 text-sm">{p.first_name}</span>
                  {p.country && <span className="text-xs text-gray-500">{p.country}</span>}
                  {p.has_resume && (
                    <span className="text-[10px] text-gray-500 border border-white/10 rounded px-1.5 py-0.5">
                      📄 resume
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{p.detail}</div>
              </div>
              <div className="text-right shrink-0">
                <Badge
                  variant="outline"
                  className={`text-xs px-2 py-0.5 ${STAGE_META[p.stage].color}`}
                >
                  {STAGE_META[p.stage].label}
                </Badge>
                <div className={`text-[11px] mt-1 ${isStuck ? 'text-amber-400' : 'text-gray-600'}`}>
                  joined {timeAgo(p.signed_up_at)} · active {timeAgo(p.last_activity_at)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Ops() {
  const { user, isLoading: authLoading } = useAuth();
  const [feed, setFeed] = useState<OpsFeedResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<string | null>(null);

  const isAdmin = !authLoading && !!user && ADMIN_EMAILS.has(user.email ?? '');

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const r = await fetch(`${supabaseUrl}/functions/v1/ops-feed`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        },
        body: JSON.stringify({}),
      });

      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }

      const data: OpsFeedResponse = await r.json();
      setFeed(data);
      setLastFetched(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    } catch (e: any) {
      setError(e.message ?? 'Failed to load ops feed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchFeed();
  }, [isAdmin, fetchFeed]);

  // Loading auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-atlas-blue" />
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-4">
        <div>
          <div className="text-lg font-semibold text-gray-200 mb-2">Sign in required</div>
          <div className="text-sm text-gray-500">
            This page is restricted. <a href="/auth" className="text-atlas-teal underline">Sign in</a>
          </div>
        </div>
      </div>
    );
  }

  // Not admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-4">
        <div>
          <div className="text-lg font-semibold text-gray-200 mb-2">Access restricted</div>
          <div className="text-sm text-gray-500">This page is for Cairnly admins only.</div>
        </div>
      </div>
    );
  }

  const items = feed?.items ?? [];
  const people = feed?.people ?? [];
  const blockers = items.filter((i) => i.severity === 'blocker');
  const support = items.filter((i) => i.source === 'support');
  const n8nErrors = items.filter((i) => i.source === 'n8n_error');
  const misses = items.filter((i) => i.source === 'assessment_miss');
  const feedback = items.filter((i) => i.source === 'chapter_feedback');
  const newThisWeek = people.filter(
    (p) => Date.now() - new Date(p.signed_up_at).getTime() < 7 * 24 * 60 * 60 * 1000,
  ).length;

  const tabLabel = (label: string, count: number) =>
    count > 0 ? `${label} (${count})` : label;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 px-4 py-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Ops Dashboard</h1>
          <div className="text-xs text-gray-600 mt-0.5">
            {lastFetched ? `Last refreshed ${lastFetched}` : 'Loading…'}
            {feed?.new_analyzed ? ` · ${feed.new_analyzed} newly analyzed` : ''}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchFeed}
          disabled={loading}
          className="border-white/20 text-gray-400 hover:text-gray-100 gap-1.5"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          Refresh
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !feed && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-xl border border-white/10 bg-white/5 animate-pulse" />
          ))}
        </div>
      )}

      {feed && (
        <div className="space-y-5">
          {/* Provider status */}
          <ProviderBanner status={feed.provider_status} />

          {/* Stats */}
          <StatsRow items={items} />

          {/* Tabs */}
          <Tabs defaultValue="blockers">
            <TabsList className="bg-white/5 border border-white/10 w-full flex flex-wrap h-auto gap-1 p-1">
              <TabsTrigger value="blockers" className="data-[state=active]:bg-red-500/20 data-[state=active]:text-red-300 text-xs">
                {tabLabel('🔴 Blockers', blockers.length)}
              </TabsTrigger>
              <TabsTrigger value="people" className="data-[state=active]:bg-white/10 text-xs">
                {tabLabel('👥 People', newThisWeek)}
              </TabsTrigger>
              <TabsTrigger value="support" className="data-[state=active]:bg-white/10 text-xs">
                {tabLabel('🎫 Support', support.length)}
              </TabsTrigger>
              <TabsTrigger value="n8n" className="data-[state=active]:bg-white/10 text-xs">
                {tabLabel('⚙️ n8n Errors', n8nErrors.length)}
              </TabsTrigger>
              <TabsTrigger value="misses" className="data-[state=active]:bg-white/10 text-xs">
                {tabLabel('🎯 Assessment Misses', misses.length)}
              </TabsTrigger>
              <TabsTrigger value="feedback" className="data-[state=active]:bg-white/10 text-xs">
                {tabLabel('💬 Feedback', feedback.length)}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="blockers" className="mt-4">
              <Feed items={blockers} />
            </TabsContent>
            <TabsContent value="people" className="mt-4">
              <div className="mb-3 text-xs text-gray-500 bg-white/5 rounded-lg px-3 py-2">
                Everyone who signed up in the last 30 days and where they are in the journey. <strong className="text-gray-400">{newThisWeek}</strong> joined this week. Identified by first name + country only.
              </div>
              <PeoplePanel people={people} />
            </TabsContent>
            <TabsContent value="support" className="mt-4">
              <Feed items={support} />
            </TabsContent>
            <TabsContent value="n8n" className="mt-4">
              <Feed items={n8nErrors} />
            </TabsContent>
            <TabsContent value="misses" className="mt-4">
              <div className="mb-3 text-xs text-gray-500 bg-white/5 rounded-lg px-3 py-2">
                <strong className="text-gray-400">How to read this:</strong> Category 2 (major) = WF6 significantly reworked the AI output based on user pushback. Category 1 (minor) = small refinements. The feedback text is WF6&apos;s own summary of what changed.
              </div>
              <Feed items={misses} />
            </TabsContent>
            <TabsContent value="feedback" className="mt-4">
              <div className="mb-3 text-xs text-gray-500 bg-white/5 rounded-lg px-3 py-2">
                Mid-chat quality ratings submitted by users after each report chapter. Useful for spotting which sections consistently get poor marks.
              </div>
              <Feed items={feedback} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
