import React, { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { isAdminEmail } from '@/lib/admins';
import { toast } from 'sonner';
import {
  Loader2, RefreshCw, ExternalLink, AlertTriangle, CheckCircle2, Image, Mail, Copy,
  Settings, Check, X, ChevronRight, Users, Activity, BarChart3, Wrench,
} from 'lucide-react';
import MarketingTab from '@/components/ops/MarketingTab';
import PartnersTab, { type PartnerDraft } from '@/components/ops/PartnersTab';
import OutreachTab from '@/components/ops/OutreachTab';
import { isWarm, type OutreachProspect, type OutreachStatus } from '@/lib/outreach';

// Project ref for Supabase deep-links from the dashboard.
const SUPABASE_PROJECT_REF = 'pcoyafgsirrznhmdaiji';
const N8N_BASE = 'https://falkoratlas.app.n8n.cloud';

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

interface DeployInfo {
  state: string;
  commit_message: string | null;
  branch: string | null;
  created_at: string | null;
  url: string;
}

interface TrafficStats {
  visits_7d: number;
  visits_today: number;
  pageviews_7d: number;
  bounce_rate_7d: number;
  top_pages: Array<{ path: string; views: number }>;
}

interface FunnelStats {
  days: number;
  sessions: number;
  demo_sessions: number;
  demo: { intake_started: number; purchase: number };
  no_demo: { intake_started: number; purchase: number };
  moments: Array<{ key: string; sessions: number }>;
  personas: Array<{ persona: string; sessions: number }>;
  entry_ctas: Array<{ cta_id: string; sessions: number }>;
}

interface N8nUsage {
  executions_this_month: number;
  limit: number;
  capped: boolean;
}

interface ProviderSpend {
  provider: string;
  amount: number | null;
  currency: string;
  error: string | null;
}

interface OpsFeedResponse {
  provider_status: { claude: ProviderStatus | null; openai: ProviderStatus | null };
  items: OpsItem[];
  people: Person[];
  deploy: DeployInfo | null;
  traffic: TrafficStats | null;
  funnel: FunnelStats | null;
  n8n_usage: N8nUsage | null;
  ai_spend: ProviderSpend[];
  fetched_at: string;
  new_analyzed: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────


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

// ─── Surfaces ─────────────────────────────────────────────────────────────────
//
// The ops console used to paint `bg-black/25` panels on the app's teal-navy
// canvas, which is why it read as a dark hole: near-black on dark, with body
// text at text-white/70/500/600. These are the assessment dashboard's own
// glass cards (src/components/dashboard/v2/dashboardV2Shared.tsx and
// DashboardV4.tsx) — same rgba, same blur, same hairline, same gold eyebrow —
// so Ops stops being a visual island and becomes legible at the same time.

/** Standard panel. Sits on the photo+gradient ground. */
const GLASS =
  'rounded-[18px] border border-white/[0.08] bg-[rgba(18,46,59,0.55)] backdrop-blur-[14px] shadow-[0_24px_50px_-22px_rgba(0,0,0,0.40)]';
/** Lifted panel — used once, for the "since your last visit" bar. */
const GLASS_RAISED =
  'rounded-[20px] border border-white/10 bg-[rgba(18,46,59,0.62)] backdrop-blur-[18px] shadow-[0_40px_80px_-28px_rgba(0,0,0,0.55)]';
/** A surface nested inside a panel (an AI-read box, a bar track). */
const INNER = 'rounded-xl bg-white/[0.04] border border-white/[0.06]';
/** Gold section label. */
const EYEBROW = 'font-heading font-bold text-[11px] tracking-[0.24em] uppercase text-[#EFBE48]';
/** The same, when it labels a number rather than a section. */
const EYEBROW_QUIET = 'font-heading font-bold text-[11px] tracking-[0.24em] uppercase text-white/55';
/** Small pill-shaped control. Nothing in Ops goes below 11px or below white/50. */
const CHIP =
  'inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function severityColor(s: Severity) {
  if (s === 'blocker') return 'bg-red-500/15 text-red-400 border-red-500/30';
  if (s === 'needs-action') return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  return 'bg-gray-500/15 text-white/70 border-gray-500/30';
}

function severityLabel(s: Severity) {
  if (s === 'blocker') return 'Blocker';
  if (s === 'needs-action') return 'Needs action';
  return 'FYI';
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
  if (i === 'critical' || i === 'major') return '#F87171';
  if (i === 'minor') return '#FBBF24';
  return '#34D399';
}

/** Status dot. Replaces the emoji circles the console used to render. */
function Dot({ color, className = '' }: { color: string; className?: string }) {
  return <span className={`h-[7px] w-[7px] rounded-full shrink-0 ${className}`} style={{ background: color }} />;
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
  signed_up: { label: '①  Signed up', color: 'bg-gray-500/15 text-white/80 border-gray-500/30', order: 0 },
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

// ─── Shell config ─────────────────────────────────────────────────────────────

type MainTab = 'partners' | 'platform' | 'stats';

/** A single "what changed" chip in the visit bar. */
interface Delta {
  label: string;
  color: string;
  onClick?: () => void;
}

const LAST_VISIT_KEY = 'ops_last_visit';
const OPEN_SECTIONS_KEY = 'ops_open_sections';
const OPS_BG_URL = '/dashboard/sections/development-tilted-stone.jpg';

/** Outreach and n8n errors are what you open the console for; the rest wait. */
const DEFAULT_OPEN: Record<string, boolean> = {
  outreach: true,
  partners: false,
  blockers: true,
  n8n: true,
  support: false,
  feedback: false,
  misses: false,
  usage: false,
  marketing: false,
};

/** Newest item in a queue, for the collapsed header line. */
function newestLine(items: OpsItem[]): string | null {
  if (items.length === 0) return null;
  const newest = [...items].sort(
    (a, b) => new Date(getItemTs(b)).getTime() - new Date(getItemTs(a)).getTime(),
  )[0];
  const ts = getItemTs(newest);
  return `Newest: ${newest.summary}${ts ? ` — ${timeAgo(ts)}` : ''}`;
}

/** Items whose timestamp is newer than the given ISO string. */
function since(items: OpsItem[], iso: string | null): OpsItem[] {
  if (!iso) return [];
  const cut = new Date(iso).getTime();
  return items.filter((i) => {
    const t = new Date(getItemTs(i) || i.analyzed_at).getTime();
    return Number.isFinite(t) && t > cut;
  });
}

// ─── Actions ──────────────────────────────────────────────────────────────────

// Builds a ready-to-paste investigation prompt for Claude Code / Cowork so the
// dashboard doubles as a command center: see an issue → copy → paste → act.
function buildClaudePrompt(item: OpsItem): string {
  const r = item.raw;
  const triage = `AI triage: ${item.summary}${item.recommended_action ? ` — ${item.recommended_action}` : ''}`;

  if (item.source === 'support') {
    return [
      'Investigate this Cairnly support ticket. Diagnose the cause and, if it points at our code/config, propose (and implement) a fix.',
      '',
      `Category: ${SUPPORT_CATEGORIES[r.category] ?? r.category}`,
      `From: ${r.email}`,
      `Page: ${r.page ?? 'unknown'}`,
      `Access code: ${r.access_code ?? 'none'}`,
      `Account ID: ${r.user_id ?? 'not logged in'}`,
      '',
      'Message:',
      '"""',
      r.message ?? '',
      '"""',
      '',
      triage,
    ].join('\n');
  }

  if (item.source === 'n8n_error') {
    return [
      'A Cairnly n8n workflow execution failed. Diagnose the root cause and propose a fix (frontend, edge function, or n8n node).',
      '',
      `Workflow: ${r.workflow_name}`,
      `Failed node: ${r.failed_node ?? 'unknown'}`,
      `Execution ID: ${r.id}`,
      `Error: ${r.error_message ?? 'unknown'}`,
      '',
      triage,
    ].join('\n');
  }

  // assessment_miss / chapter_feedback
  return [
    `Review this Cairnly ${item.source === 'assessment_miss' ? 'assessment correction (WF6 reworked the AI output)' : 'user chapter feedback'} and assess whether the assessment prompts/logic need adjusting to prevent it recurring.`,
    '',
    `Section: ${r.section_type ?? 'unknown'}`,
    `Feedback category: ${r.feedback_category ?? 'n/a'}`,
    '',
    'Detail:',
    '"""',
    r.feedback ?? '',
    '"""',
    '',
    triage,
  ].join('\n');
}

async function copyForClaude(item: OpsItem) {
  try {
    await navigator.clipboard.writeText(buildClaudePrompt(item));
    toast.success('Copied — paste into Claude Code or Cowork to act on it');
  } catch {
    toast.error('Copy failed — your browser blocked clipboard access');
  }
}

// A small pill-style action button used in the card footer.
function ActionButton({
  onClick,
  href,
  icon,
  children,
}: {
  onClick?: () => void;
  href?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const cls =
    'inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-white/15 text-white/80 hover:text-white hover:border-white/30 hover:bg-white/5 transition-colors';
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {icon}
        {children}
      </a>
    );
  }
  return (
    <button onClick={onClick} className={cls}>
      {icon}
      {children}
    </button>
  );
}

// ─── Provider status banner ───────────────────────────────────────────────────

function ProviderBanner({ status }: { status: OpsFeedResponse['provider_status'] }) {
  const providers = [
    { name: 'Claude (Anthropic)', data: status.claude, url: 'https://status.anthropic.com' },
    { name: 'OpenAI', data: status.openai, url: 'https://status.openai.com' },
  ];

  return (
    <Card className={GLASS}>
      <CardContent className="py-3 px-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-white/60">
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
              <Dot color={data ? indicatorDot(data.indicator) : 'rgba(255,255,255,0.30)'} />
              <span className={data ? indicatorColor(data.indicator) : 'text-white/60'}>
                {name}
              </span>
              {data && data.indicator !== 'none' && (
                <span className="text-xs text-amber-400">— {data.description}</span>
              )}
              {!data && <span className="text-xs text-white/50">— unreachable</span>}
              <ExternalLink size={11} className="text-white/50" />
            </a>
          ))}
        </div>
        {/* Only surface incidents during a real outage (major/critical) — a
            model deprecation / suspension notice isn't urgent and shouldn't shout. */}
        {[status.claude, status.openai]
          .filter((s) => s && (s.indicator === 'major' || s.indicator === 'critical'))
          .flatMap((s) => s!.incidents)
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

// ─── Deploy strip ─────────────────────────────────────────────────────────────

function deployVisual(state: string): { dot: string; color: string; label: string } {
  const s = state.toUpperCase();
  if (s === 'READY') return { dot: '#34D399', color: 'text-emerald-400', label: 'Ready' };
  if (s === 'ERROR' || s === 'CANCELED') return { dot: '#F87171', color: 'text-red-400', label: s === 'ERROR' ? 'Failed' : 'Canceled' };
  if (s === 'BUILDING' || s === 'QUEUED' || s === 'INITIALIZING')
    return { dot: '#FBBF24', color: 'text-amber-400', label: s.charAt(0) + s.slice(1).toLowerCase() };
  return { dot: 'rgba(255,255,255,0.30)', color: 'text-white/60', label: state };
}

function DeployStrip({ deploy }: { deploy: DeployInfo | null }) {
  if (!deploy) return null;
  const v = deployVisual(deploy.state);
  return (
    <a
      href={deploy.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-2 ${GLASS} px-4 py-2.5 text-xs hover:border-white/25 transition-colors`}
    >
      <span className="font-semibold uppercase tracking-widest text-white/60">Deploy</span>
      <Dot color={v.dot} />
      <span className={v.color}>{v.label}</span>
      {deploy.commit_message && (
        <span className="text-white/70 truncate min-w-0 max-w-[150px] xl:max-w-[240px]">· {deploy.commit_message.split('\n')[0]}</span>
      )}
      {deploy.branch && <span className="text-white/50 font-mono hidden xl:inline shrink-0">· {deploy.branch}</span>}
      {deploy.created_at && <span className="text-white/50 ml-auto shrink-0">{timeAgo(deploy.created_at)}</span>}
      <ExternalLink size={11} className="text-white/50 shrink-0" />
    </a>
  );
}

// ─── Item card ────────────────────────────────────────────────────────────────

function ItemCard({ item, onDismiss }: { item: OpsItem; onDismiss: (key: string) => void }) {
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
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/60 mt-1">
        <span>{raw.email ?? '—'}</span>
        {raw.page && <span className="font-mono truncate max-w-[200px]">{raw.page}</span>}
        {raw.access_code && <span>code: <span className="font-mono">{raw.access_code}</span></span>}
      </div>
    );
  }

  if (item.source === 'n8n_error') {
    title = raw.workflow_name ?? 'n8n Error';
    meta = (
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/60 mt-1">
        {raw.failed_node && <span>Node: <span className="font-mono">{raw.failed_node}</span></span>}
        {raw.id && <span className="font-mono">exec {raw.id}</span>}
      </div>
    );
  }

  if (item.source === 'assessment_miss') {
    const cat = String(raw.feedback_category ?? '');
    title = cat === '2' ? 'Major AI correction' : 'Minor AI refinement';
    meta = (
      <div className="text-xs text-white/60 mt-1">
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
    <Card className={`border transition-all ${item.severity === 'blocker' ? 'border-red-500/40 bg-red-500/5' : item.severity === 'needs-action' ? 'border-amber-500/30 bg-amber-500/5' : GLASS}`}>
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
              <Badge variant="outline" className="text-xs px-2 py-0.5 border-white/20 text-white/70">
                {sourceLabel(item.source)}
              </Badge>
              {item.stage && item.stage !== 'unknown' && (
                <Badge variant="outline" className="text-xs px-2 py-0.5 border-white/10 text-white/60">
                  {item.stage}
                </Badge>
              )}
              {item.upstream_flag && (
                <Badge variant="outline" className="text-xs px-2 py-0.5 border-amber-500/40 text-amber-400">
                  ⚠ Likely upstream
                </Badge>
              )}
            </div>
            <div className="font-medium text-white/[0.88] text-sm">{title}</div>
            {meta}
          </div>
          <div className="text-xs text-white/50 whitespace-nowrap shrink-0">{fmtDate(ts)}</div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-3">
        {/* AI summary */}
        <div className={`${INNER} px-3.5 py-3`}>
          <div className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-1">AI read</div>
          <div className="text-sm text-white/[0.88]">{item.summary}</div>
          {item.recommended_action && (
            <div className="text-xs text-atlas-teal mt-1.5">→ {item.recommended_action}</div>
          )}
        </div>

        {/* Message / error body */}
        {bodyText && (
          <div>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-white/60 hover:text-white transition-colors"
            >
              {expanded ? '▾ Hide detail' : '▸ Show detail'}
            </button>
            {expanded && (
              <div className={`mt-2 text-sm text-white/80 ${INNER} px-3.5 py-3 whitespace-pre-wrap max-h-64 overflow-y-auto`}>
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
              className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors"
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

        {/* Actions — the command-center row */}
        <div className="flex flex-wrap gap-2 pt-1">
          {item.source === 'support' && raw.email && (
            <ActionButton
              href={`mailto:${raw.email}?subject=${encodeURIComponent(
                `Re: your Cairnly support request${raw.category ? ` (${SUPPORT_CATEGORIES[raw.category] ?? raw.category})` : ''}`,
              )}`}
              icon={<Mail size={12} />}
            >
              Reply
            </ActionButton>
          )}
          {item.source === 'support' && (
            <ActionButton
              href={`https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}/editor`}
              icon={<Settings size={12} />}
            >
              Supabase
            </ActionButton>
          )}
          {item.source === 'n8n_error' && raw.workflowId && (
            <ActionButton
              href={`${N8N_BASE}/workflow/${raw.workflowId}/executions/${raw.id}`}
              icon={<Settings size={12} />}
            >
              Open in n8n
            </ActionButton>
          )}
          <ActionButton onClick={() => copyForClaude(item)} icon={<Copy size={12} />}>
            Copy for Claude
          </ActionButton>
          <button
            onClick={() => onDismiss(item.key)}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-colors ml-auto"
          >
            {item.source === 'support' ? <Check size={12} /> : <X size={12} />}
            {item.source === 'support' ? 'Mark resolved' : 'Dismiss'}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Feed list ────────────────────────────────────────────────────────────────

function Feed({ items, onDismiss }: { items: OpsItem[]; onDismiss: (key: string) => void }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-white/50">
        <CheckCircle2 size={32} className="mb-3 text-emerald-600" />
        <div className="text-sm">Nothing here</div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <ItemCard key={item.key} item={item} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// ─── Usage & spend ────────────────────────────────────────────────────────────

function UsagePanel({ usage, spend }: { usage: N8nUsage | null; spend: ProviderSpend[] }) {
  const month = new Date().toLocaleDateString('en-GB', { month: 'long' });

  const fmtMoney = (p: ProviderSpend) => {
    if (p.error) return '—';
    if (p.amount == null) return '—';
    return `$${p.amount.toFixed(2)}`;
  };

  let bar = 'bg-emerald-500';
  let pct = 0;
  if (usage && usage.limit > 0) {
    pct = Math.min(100, Math.round((usage.executions_this_month / usage.limit) * 100));
    bar = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
  }

  return (
    <div className="space-y-4">
      {/* n8n executions */}
      <div className={`${GLASS} px-5 py-5`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-white/[0.88]">⚙️ n8n executions — {month}</span>
          <a
            href="https://app.n8n.cloud/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-atlas-teal hover:underline"
          >
            n8n usage <ExternalLink size={11} />
          </a>
        </div>
        {usage ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white/[0.92]">
                {usage.capped ? '5,000+' : usage.executions_this_month.toLocaleString()}
              </span>
              <span className="text-sm text-white/60">/ {usage.limit.toLocaleString()} ({pct}%)</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-white/5 overflow-hidden">
              <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="text-[11px] text-white/50 mt-1.5">
              Approx from the n8n API (includes Outside Input — same instance). Exact figure on the n8n dashboard.
            </div>
          </>
        ) : (
          <div className="text-sm text-white/50">n8n usage unavailable.</div>
        )}
      </div>

      {/* AI spend */}
      <div>
        <div className="text-sm font-medium text-white/80 mb-2">💰 AI spend — {month} (month to date)</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {spend.map((p) => (
            <div key={p.provider} className={`${GLASS} px-5 py-4`}>
              <div className="text-2xl font-bold text-white/[0.92]">{fmtMoney(p)}</div>
              <div className="text-xs text-white/70 mt-0.5">{p.provider}</div>
              {p.error && <div className="text-[11px] text-amber-500 mt-0.5">{p.error}</div>}
            </div>
          ))}
          {/* Google — no spend API; link to GCP billing */}
          <a
            href="https://console.cloud.google.com/billing"
            target="_blank"
            rel="noopener noreferrer"
            className={`${GLASS} px-5 py-4 hover:border-white/25 transition-colors flex flex-col justify-center`}
          >
            <div className="text-sm font-medium text-white/80 flex items-center gap-1">
              Google <ExternalLink size={11} className="text-white/50" />
            </div>
            <div className="text-[11px] text-white/60 mt-0.5">View in GCP Billing</div>
          </a>
        </div>
        {spend.length === 0 && (
          <div className="text-xs text-white/50 mt-2">
            No provider keys set. Add <span className="font-mono text-white/70">OPENAI_ADMIN_KEY</span> / <span className="font-mono text-white/70">ANTHROPIC_ADMIN_KEY</span> as Supabase secrets to enable spend cards.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Traffic ──────────────────────────────────────────────────────────────────

function TrafficPanel({ traffic, funnel }: { traffic: TrafficStats | null; funnel: FunnelStats | null }) {
  if (!traffic) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-white/50">
        <div className="text-sm">No traffic data yet</div>
        <div className="text-xs text-white/50 mt-1">Collection starts once this is deployed — check back in a bit.</div>
      </div>
    );
  }

  const stat = (label: string, value: string, sub?: string) => (
    <div className={`${GLASS} px-5 py-4`}>
      <div className="text-2xl font-bold text-white/[0.92]">{value}</div>
      <div className="text-xs text-white/70 mt-0.5">{label}</div>
      {sub && <div className="text-[11px] text-white/50 mt-0.5">{sub}</div>}
    </div>
  );

  const maxViews = Math.max(1, ...(traffic.top_pages ?? []).map((p) => p.views));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stat('Visitors (7d)', String(traffic.visits_7d), `${traffic.pageviews_7d} pageviews`)}
        {stat('Visitors today', String(traffic.visits_today))}
        {stat('Bounce rate (7d)', `${traffic.bounce_rate_7d}%`, 'one page, left <10s')}
        {stat('Pages / visit', traffic.visits_7d > 0 ? (traffic.pageviews_7d / traffic.visits_7d).toFixed(1) : '—')}
      </div>

      <div className={`${GLASS} px-5 py-4`}>
        <div className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-2">Top pages (7d)</div>
        {(traffic.top_pages ?? []).length === 0 ? (
          <div className="text-sm text-white/50">No pages yet</div>
        ) : (
          <div className="space-y-1.5">
            {traffic.top_pages.map((p) => (
              <div key={p.path} className="flex items-center gap-3">
                <span className="font-mono text-xs text-white/80 w-40 truncate shrink-0">{p.path}</span>
                <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full bg-atlas-teal/60 rounded-full" style={{ width: `${(p.views / maxViews) * 100}%` }} />
                </div>
                <span className="text-xs text-white/60 w-10 text-right shrink-0">{p.views}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <FunnelPanel funnel={funnel} />

      <div className="text-xs text-white/50">
        First-party tracking — counts unique per-tab sessions, no cookies or PII. A “bounce” is a visit that saw only one page and left within 10 seconds (engaged sessions don't count). Dev servers, preview deploys, headless browsers and browsers carrying the internal flag (<span className="font-mono">?internal=1</span>) are not counted at all.
      </div>
    </div>
  );
}

// ─── Demo funnel ──────────────────────────────────────────────────────────────
//
// The question the demo exists to answer: do the people who read it convert
// more than the people who don't? Everything is counted in sessions.

const MOMENT_LABELS: Record<string, string> = {
  pushback: 'Pushback',
  kept: 'Kept in the report',
  pillTag: 'The button label',
  movePill: 'The Move button',
  radar: 'The radar',
  askRole: 'Ask about this role',
  dictated: 'Dictated',
};
const MOMENT_ORDER = ['pushback', 'kept', 'pillTag', 'movePill', 'radar', 'askRole', 'dictated'];

function FunnelPanel({ funnel }: { funnel: FunnelStats | null }) {
  if (!funnel) {
    return (
      <div className={`${GLASS} px-5 py-4 text-xs text-white/60`}>
        Demo funnel not available yet — the analytics migration hasn't been applied.
      </div>
    );
  }

  const rate = (n: number, total: number) => (total > 0 ? `${Math.round((100 * n) / total)}%` : '—');
  const nonDemo = Math.max(0, funnel.sessions - funnel.demo_sessions);
  const moments = MOMENT_ORDER.map((key) => ({
    key,
    sessions: funnel.moments.find((m) => m.key === key)?.sessions ?? 0,
  }));
  const maxMoment = Math.max(1, ...moments.map((m) => m.sessions));

  return (
    <div className={`${GLASS} px-5 py-4 space-y-4`}>
      <div className="text-xs font-semibold uppercase tracking-widest text-white/60">
        Demo funnel ({funnel.days}d)
      </div>

      {/* Did the demo move anything? */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Saw the demo', sessions: funnel.demo_sessions, data: funnel.demo },
          { label: 'Did not', sessions: nonDemo, data: funnel.no_demo },
        ].map(({ label, sessions, data }) => (
          <div key={label} className={`${INNER} px-3.5 py-3`}>
            <div className="text-[11px] uppercase tracking-wider text-white/60">{label}</div>
            <div className="text-xl font-bold text-white/[0.92] mt-0.5">{sessions}</div>
            <div className="text-[11px] text-white/70 mt-1.5 space-y-0.5">
              <div>
                Intake started <span className="text-white/[0.88] font-semibold">{data.intake_started}</span>{' '}
                <span className="text-white/50">({rate(data.intake_started, sessions)})</span>
              </div>
              <div>
                Purchased <span className="text-white/[0.88] font-semibold">{data.purchase}</span>{' '}
                <span className="text-white/50">({rate(data.purchase, sessions)})</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* How far into the replay they get */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-white/60 mb-1.5">
          Depth in the replay (sessions reaching each moment)
        </div>
        <div className="space-y-1">
          {moments.map((m) => (
            <div key={m.key} className="flex items-center gap-3">
              <span className="text-xs text-white/70 w-40 truncate shrink-0">{MOMENT_LABELS[m.key] ?? m.key}</span>
              <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full bg-atlas-teal/60 rounded-full" style={{ width: `${(m.sessions / maxMoment) * 100}%` }} />
              </div>
              <span className="text-xs text-white/60 w-8 text-right shrink-0">{m.sessions}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Who they read, and what sent them in */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-white/60 mb-1.5">Persona read</div>
          {funnel.personas.length === 0 ? (
            <div className="text-xs text-white/50">Nothing yet</div>
          ) : (
            funnel.personas.map((p) => (
              <div key={p.persona} className="flex justify-between text-xs text-white/70 py-0.5">
                <span className="capitalize">{p.persona}</span>
                <span className="text-white/[0.88] font-semibold">{p.sessions}</span>
              </div>
            ))
          )}
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-white/60 mb-1.5">Entry CTA</div>
          {funnel.entry_ctas.length === 0 ? (
            <div className="text-xs text-white/50">Nothing yet</div>
          ) : (
            funnel.entry_ctas.slice(0, 6).map((c) => (
              <div key={c.cta_id} className="flex justify-between gap-2 text-xs text-white/70 py-0.5">
                <span className="font-mono truncate">{c.cta_id}</span>
                <span className="text-white/[0.88] font-semibold shrink-0">{c.sessions}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── People funnel ────────────────────────────────────────────────────────────

function PeoplePanel({ people }: { people: Person[] }) {
  if (people.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-white/50">
        <div className="text-sm">No signups in the last 30 days</div>
      </div>
    );
  }

  // Funnel counts per stage
  const counts = people.reduce<Record<string, number>>((acc, p) => {
    acc[p.stage] = (acc[p.stage] ?? 0) + 1;
    return acc;
  }, {});
  const stalled = people.filter(
    (p) => p.stage !== 'done' && Date.now() - new Date(p.last_activity_at).getTime() > 3 * 24 * 60 * 60 * 1000,
  );
  const stuck = stalled.length;
  const stalledByStage = stalled.reduce<Record<string, number>>((acc, p) => {
    acc[p.stage] = (acc[p.stage] ?? 0) + 1;
    return acc;
  }, {});
  const stalledStages = (Object.keys(STAGE_META) as Stage[]).filter((s) => stalledByStage[s]);
  const maxStalled = Math.max(1, ...Object.values(stalledByStage));

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
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-amber-400 mb-2.5">
            <AlertTriangle size={13} />
            {stuck} {stuck === 1 ? 'person has' : 'people have'} stalled 3+ days mid-journey — here's where they're getting stuck:
          </div>
          <div className="space-y-1.5">
            {stalledStages.map((s) => (
              <div key={s} className="flex items-center gap-3">
                <span className="text-xs text-white/80 w-32 truncate shrink-0">
                  {STAGE_META[s].label.replace(/^[①②③④⑤⑥]\s+/, '')}
                </span>
                <div className="flex-1 h-2 rounded-full bg-white/[0.07] overflow-hidden">
                  <div
                    className="h-full bg-amber-500/70 rounded-full"
                    style={{ width: `${(stalledByStage[s] / maxStalled) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-white/70 w-8 text-right shrink-0">{stalledByStage[s]}</span>
              </div>
            ))}
          </div>
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
              className={`flex items-center gap-3 ${GLASS} px-4 py-3`}
            >
              <span className="text-xl shrink-0" title={p.country ?? 'Unknown country'}>
                {countryFlag(p.country)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-white/[0.88] text-sm">{p.first_name}</span>
                  {p.country && <span className="text-xs text-white/60">{p.country}</span>}
                  {p.has_resume && (
                    <span className="text-[11px] text-white/60 border border-white/[0.14] rounded px-1.5 py-0.5">
                      resume
                    </span>
                  )}
                </div>
                <div className="text-xs text-white/60 mt-0.5">{p.detail}</div>
              </div>
              <div className="text-right shrink-0">
                <Badge
                  variant="outline"
                  className={`text-xs px-2 py-0.5 ${STAGE_META[p.stage].color}`}
                >
                  {STAGE_META[p.stage].label}
                </Badge>
                <div className={`text-[11px] mt-1 ${isStuck ? 'text-amber-400' : 'text-white/50'}`}>
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

// Admin tool: re-fire the n8n WF1→WF4 pipeline for a report by ID. Calls the
// `rerun_report` SQL function (admin-gated, clears old sections first so the
// pipeline can't append duplicates). Replaces the manual "assemble the WF1 JSON
// and paste it into the webhook" dance.
function RerunReportCard() {
  const [reportId, setReportId] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const run = async (dryRun: boolean) => {
    const q = reportId.trim();
    let fn: string;
    let args: Record<string, unknown>;
    if (UUID_RE.test(q)) {
      fn = 'rerun_report';
      args = { p_report_id: q, p_dry_run: dryRun };
    } else if (EMAIL_RE.test(q)) {
      fn = 'rerun_report_by_email';
      args = { p_email: q, p_dry_run: dryRun };
    } else {
      toast.error('Enter an email or a report ID (UUID).');
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      // These functions aren't in the generated Supabase types yet; cast to call them.
      const { data, error } = await (supabase as unknown as {
        rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
      }).rpc(fn, args);
      if (error) throw error;
      const r = data as Record<string, unknown>;
      const who = r?.matched_name ? `${r.matched_name as string} — ` : '';
      if (!r?.ok) {
        toast.error(`Re-run blocked: ${(r?.error as string) ?? 'unknown error'}`);
      } else if (dryRun) {
        toast.success(`Dry run OK — ${who}report ${String(r.report_id).slice(0, 8)}…, ${r.survey_responses_keys} answers`);
      } else {
        toast.success(`Re-run fired — ${who}HTTP ${r.http_status}. Report regenerating…`);
      }
      setResult(JSON.stringify(r, null, 2));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
      setResult(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`${GLASS} px-5 py-5`}>
      <div className="flex items-center gap-2 mb-1">
        <RefreshCw size={15} className="text-emerald-400" />
        <h2 className="text-sm font-semibold text-white/[0.92]">Re-run a report</h2>
      </div>
      <p className="text-xs text-white/60 mb-3">
        Enter a user's email (uses their latest report) or a report ID. Re-fires the WF1 → WF4
        pipeline from the saved answers, clearing old sections first so nothing duplicates.
        This regenerates the report and may email the user.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={reportId}
          onChange={(e) => setReportId(e.target.value)}
          placeholder="email or report ID"
          spellCheck={false}
          disabled={busy}
          className="flex-1 bg-[#0E2531] border border-white/15 rounded-lg px-3 py-2 text-sm text-white/90 placeholder:text-white/40 focus:outline-none focus:border-emerald-500/50 font-mono"
        />
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => run(true)}
          className="border-white/20 text-white/70 hover:text-white"
        >
          Dry run
        </Button>
        <Button
          size="sm"
          disabled={busy}
          onClick={() => run(false)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Re-run
        </Button>
      </div>
      {result && (
        <pre className={`mt-3 text-[11px] text-white/70 ${INNER} px-3 py-2 overflow-x-auto whitespace-pre-wrap`}>
          {result}
        </pre>
      )}
    </div>
  );
}

// ─── Shell: top bar, delta bar, tabs, collapsible sections ────────────────────

/**
 * "Since your last visit" needs a previous timestamp. A single-admin console
 * doesn't warrant a table for it, so it lives in localStorage: we read the
 * stored value once on mount (that's the one we compare against for the whole
 * session) and immediately stamp "now", so the next visit measures from when
 * this one started. First ever visit → null → the bar shows nothing.
 */
function useLastVisit(): string | null {
  const [since] = useState<string | null>(() => {
    try {
      const prev = localStorage.getItem(LAST_VISIT_KEY);
      localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString());
      return prev;
    } catch {
      return null;
    }
  });
  return since;
}

/** Which sections are expanded, remembered between visits. */
function useOpenSections() {
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(OPEN_SECTIONS_KEY);
      if (raw) return { ...DEFAULT_OPEN, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    return DEFAULT_OPEN;
  });
  const toggle = useCallback((key: string) => {
    setOpen((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(OPEN_SECTIONS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);
  return { open, toggle };
}

/** Cream bar, same spec as the assessment dashboard's DashboardAppNav. */
function OpsTopBar({
  lastFetched,
  newAnalyzed,
  loading,
  onRefresh,
}: {
  lastFetched: string | null;
  newAnalyzed: number;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <header
      className="px-4 sm:px-8 flex items-center justify-between sticky top-0 z-50"
      style={{ background: '#ECE4D2', borderBottom: '1px solid #C9B690', paddingTop: 11, paddingBottom: 11 }}
    >
      <div className="flex items-center gap-3.5">
        <span className="font-heading font-bold text-[19px] tracking-[-0.02em]" style={{ color: '#122E3B' }}>
          Cairnly
        </span>
        <span
          className="font-heading font-bold text-[11px] tracking-[0.24em] rounded-full px-2.5 py-1"
          style={{ color: '#1F8282', border: '1px solid rgba(31,130,130,0.35)', background: 'rgba(39,161,161,0.10)' }}
        >
          OPS
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-xs hidden sm:inline" style={{ color: '#4B6373' }}>
          {lastFetched ? `Refreshed ${lastFetched}` : 'Loading…'}
          {newAnalyzed ? ` · ${newAnalyzed} newly analyzed` : ''}
          {' · auto every 5 min'}
        </span>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-semibold disabled:opacity-60"
          style={{ border: '1px solid #C9B690', background: '#F5EFE2', color: '#122E3B' }}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Refresh
        </button>
      </div>
    </header>
  );
}

/** One delta chip in the "since your last visit" bar. */
function DeltaChip({ color, children, onClick }: { color: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={CHIP}>
      <span className="h-[7px] w-[7px] rounded-full shrink-0" style={{ background: color }} />
      {children}
    </button>
  );
}

/**
 * The bar that answers "what happened while I was away". Present on all three
 * tabs — it replaces the old Overview tab, whose four numbers were duplicated
 * on the tabs they linked to.
 */
function VisitBar({ since, deltas }: { since: string | null; deltas: Delta[] }) {
  if (!since) return null;
  const when = new Date(since).toLocaleString('en-GB', {
    weekday: 'long', hour: '2-digit', minute: '2-digit',
  });
  return (
    <div className={`${GLASS_RAISED} px-6 py-5 flex flex-col lg:flex-row lg:items-center gap-5 lg:gap-7`}>
      <div className="shrink-0">
        <div className={EYEBROW}>Since your last visit</div>
        <div className="text-[13px] text-white/60 mt-1.5">
          {when} · {timeAgo(since)}
        </div>
      </div>
      <div className="hidden lg:block w-px self-stretch bg-white/10 shrink-0" />
      <div className="flex flex-wrap gap-2 flex-1">
        {deltas.length === 0 ? (
          <span className="text-[13px] text-white/55">Nothing new.</span>
        ) : (
          deltas.map((d) => (
            <DeltaChip key={d.label} color={d.color} onClick={d.onClick}>
              {d.label}
            </DeltaChip>
          ))
        )}
      </div>
    </div>
  );
}

/** Partners · Platform · Stats. */
function MainTabs({
  active,
  onSelect,
  partnersBadge,
  platformBadge,
  platformUrgent,
}: {
  active: MainTab;
  onSelect: (t: MainTab) => void;
  partnersBadge: number;
  platformBadge: number;
  platformUrgent: boolean;
}) {
  const tabs: Array<{ id: MainTab; label: string; icon: React.ReactNode; badge: number; urgent?: boolean }> = [
    { id: 'partners', label: 'Partners', icon: <Users size={17} />, badge: partnersBadge },
    { id: 'platform', label: 'Platform', icon: <Activity size={17} />, badge: platformBadge, urgent: platformUrgent },
    { id: 'stats', label: 'Stats', icon: <BarChart3 size={17} />, badge: 0 },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((t) => {
        const on = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`inline-flex items-center gap-2.5 font-heading font-semibold text-[14.5px] px-5 py-2.5 rounded-xl border transition-all ${
              on
                ? 'bg-[rgba(236,228,210,0.95)] text-[#122E3B] border-[rgba(201,182,144,0.6)] shadow-[0_10px_26px_-12px_rgba(0,0,0,0.55)]'
                : 'bg-[rgba(18,46,59,0.45)] text-white/65 border-white/[0.08] hover:text-white/90 hover:border-white/20'
            }`}
          >
            {t.icon}
            {t.label}
            {t.badge > 0 && (
              <span
                className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold ${
                  t.urgent
                    ? 'bg-red-500 text-white'
                    : on
                      ? 'bg-[rgba(212,160,36,0.22)] text-[#8A6410]'
                      : 'bg-[rgba(239,190,72,0.18)] text-[#EFBE48]'
                }`}
              >
                {t.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A tab is already an overview: the header carries the count and the newest
 * line, and you expand the ones you want. Collapsed state is remembered.
 */
function SectionCard({
  id,
  title,
  subtitle,
  pills,
  open,
  onToggle,
  tone = 'normal',
  children,
}: {
  id: string;
  title: string;
  subtitle?: React.ReactNode;
  pills?: React.ReactNode;
  open: boolean;
  onToggle: (id: string) => void;
  tone?: 'normal' | 'blocker';
  children: React.ReactNode;
}) {
  const shell =
    tone === 'blocker'
      ? 'rounded-[18px] border border-red-400/35 bg-red-500/[0.07] shadow-[0_24px_50px_-22px_rgba(0,0,0,0.40)]'
      : GLASS;
  return (
    <div className={shell}>
      <button
        onClick={() => onToggle(id)}
        aria-expanded={open}
        className="flex items-center gap-3.5 w-full text-left px-6 py-[18px] group"
      >
        <ChevronRight
          size={18}
          className={`shrink-0 text-white/55 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        />
        <div className="flex-1 min-w-0">
          <h2 className="font-heading font-semibold text-[17px] text-white/[0.92] tracking-[-0.01em] group-hover:text-white m-0">
            {title}
          </h2>
          {subtitle && <div className="text-[12.5px] text-white/55 mt-1 truncate">{subtitle}</div>}
        </div>
        {pills && <div className="flex items-center gap-2 shrink-0">{pills}</div>}
      </button>
      {open && <div className={`border-t ${tone === 'blocker' ? 'border-red-400/20' : 'border-white/[0.07]'} px-6 py-5`}>{children}</div>}
    </div>
  );
}

/** Count pill used in section headers. */
function CountPill({ n, tone }: { n: number; tone: 'red' | 'amber' | 'teal' | 'gold' | 'blue' | 'quiet' }) {
  const map: Record<string, string> = {
    red: 'bg-red-500/20 text-red-300 border-red-400/40',
    amber: 'bg-amber-500/16 text-amber-300 border-amber-400/35',
    teal: 'bg-atlas-teal/16 text-[#2ABFBF] border-[#2ABFBF]/35',
    gold: 'bg-[rgba(212,160,36,0.16)] text-[#EFBE48] border-[rgba(239,190,72,0.38)]',
    blue: 'bg-[rgba(57,137,175,0.18)] text-[#7FBCD9] border-[#7FBCD9]/32',
    quiet: 'bg-white/[0.06] text-white/60 border-white/[0.16]',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${map[tone]}`}>
      {n}
    </span>
  );
}

/** Headline number on a glass tile. */
function StatTile({
  label,
  value,
  sub,
  delta,
  tone = 'normal',
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  delta?: string;
  tone?: 'normal' | 'gold';
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`${
        tone === 'gold'
          ? 'rounded-[18px] border border-[rgba(239,190,72,0.32)] bg-[rgba(212,160,36,0.09)] shadow-[0_24px_50px_-22px_rgba(0,0,0,0.40)]'
          : GLASS
      } px-5 py-5 text-left ${onClick ? 'hover:border-white/25 transition-colors' : ''}`}
    >
      <div className={tone === 'gold' ? EYEBROW : EYEBROW_QUIET}>{label}</div>
      <div className="flex items-baseline gap-2.5 mt-2">
        <span
          className={`font-heading font-semibold text-[34px] tracking-[-0.02em] ${
            tone === 'gold' ? 'text-[#EFBE48]' : 'text-white'
          }`}
        >
          {value}
        </span>
        {delta && <span className="text-[12.5px] font-semibold text-emerald-400">{delta}</span>}
      </div>
      {sub && <div className="text-xs text-white/55 mt-1">{sub}</div>}
    </Tag>
  );
}

/**
 * Blockers are the only thing allowed above the tabs, and only while there are
 * any. No blockers → this renders nothing at all: no band, no tab, no red zero.
 */
function BlockerBand({
  blockers,
  newCount,
  onOpen,
}: {
  blockers: OpsItem[];
  newCount: number;
  onOpen: () => void;
}) {
  if (blockers.length === 0) return null;
  return (
    <div
      className="rounded-[20px] border border-red-400/45 px-6 py-5"
      style={{
        background: 'linear-gradient(180deg, rgba(239,68,68,0.18) 0%, rgba(239,68,68,0.10) 100%)',
        boxShadow: '0 40px 80px -28px rgba(0,0,0,0.55)',
      }}
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-[11px] bg-red-500/20 border border-red-400/40 flex items-center justify-center shrink-0">
          <AlertTriangle size={21} className="text-red-300" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-heading font-bold text-[19px] text-white tracking-[-0.01em]">
              {newCount > 0
                ? `${newCount} new blocker${newCount === 1 ? '' : 's'}`
                : `${blockers.length} open blocker${blockers.length === 1 ? '' : 's'}`}
            </span>
            {newCount > 0 && blockers.length > newCount && (
              <span className="inline-flex items-center rounded-full border border-red-400/40 bg-red-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-red-200">
                {blockers.length - newCount} still open from before
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2.5 mt-4">
            {blockers.slice(0, 3).map((b) => (
              <div key={b.key} className="flex items-baseline gap-3 flex-wrap">
                <span className="h-[7px] w-[7px] rounded-full bg-red-400 shrink-0 self-center" />
                <span className="text-sm text-white/[0.92] font-semibold">{sourceLabel(b.source)}</span>
                <span className="text-[13px] text-white/70 flex-1 min-w-0">{b.summary}</span>
                <span className="text-xs text-white/55 shrink-0">{timeAgo(getItemTs(b))}</span>
              </div>
            ))}
            {blockers.length > 3 && (
              <div className="text-[13px] text-white/60 pl-[19px]">+ {blockers.length - 3} more</div>
            )}
          </div>
          <div className="flex gap-2.5 mt-5">
            <button
              onClick={onOpen}
              className="inline-flex items-center gap-2 rounded-full px-4.5 py-2 text-[13px] font-semibold bg-red-500 text-white shadow-[0_10px_24px_-8px_rgba(239,68,68,0.55)] hover:bg-red-400 transition-colors"
              style={{ paddingLeft: 18, paddingRight: 18 }}
            >
              Go to the blockers
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Partners overview ────────────────────────────────────────────────────────
//
// The Partners tab leads with where the outreach pipeline actually stands.
// OutreachTab fetches its own table (unchanged); this pulls the same list once
// at page level so the tiles, the pipeline bar and the "since your last visit"
// deltas can be computed without reaching into that component.

interface OutreachSummary {
  prospects: OutreachProspect[];
  withClick: number;
  clicksToday: number;
}

/** Every status maps into exactly one bucket, so the bar always sums to the total. */
const PIPELINE: Array<{ label: string; statuses: OutreachStatus[]; color: string; cap: 'left' | 'right' | null }> = [
  { label: 'Not contacted', statuses: ['nog_niet_benaderd'], color: 'rgba(255,255,255,0.10)', cap: 'left' },
  { label: 'Sent', statuses: ['verzonden', 'opvolging_1', 'opvolging_2'], color: 'rgba(39,161,161,0.32)', cap: null },
  { label: 'Replied', statuses: ['gereageerd'], color: 'rgba(39,161,161,0.58)', cap: null },
  { label: 'In talks', statuses: ['gesprek_gepland', 'gesprek_gevoerd', 'pilot_afgesproken'], color: 'rgba(42,191,191,0.88)', cap: null },
  { label: 'Partner', statuses: ['partner_aangemaakt', 'codes_gemint', 'pilot_gestart', 'founding_partner'], color: '#EFBE48', cap: null },
  { label: 'No fit', statuses: ['afgewezen', 'geen_fit'], color: 'rgba(255,255,255,0.16)', cap: 'right' },
];

function PipelineBar({ prospects }: { prospects: OutreachProspect[] }) {
  const buckets = PIPELINE.map((b) => ({
    ...b,
    n: prospects.filter((p) => b.statuses.includes(p.status)).length,
  }));
  const total = Math.max(1, prospects.length);
  return (
    <div className="flex items-end gap-1.5">
      {buckets.map((b) => (
        <div key={b.label} style={{ flex: Math.max(0.25, (b.n / total) * 6) }}>
          <div
            className="h-[30px]"
            style={{
              background: b.color,
              borderRadius: b.cap === 'left' ? '6px 2px 2px 6px' : b.cap === 'right' ? '2px 6px 6px 2px' : 2,
            }}
          />
          <div className="text-[11.5px] text-white/55 mt-1.5 truncate">{b.label}</div>
          <div className="font-heading font-semibold text-[15px] text-white mt-px">{b.n}</div>
        </div>
      ))}
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
  const [activeTab, setActiveTab] = useState<MainTab>('partners');
  // "Partner aanmaken" on an outreach row hands name + slug to the Partners section.
  const [partnerDraft, setPartnerDraft] = useState<PartnerDraft | null>(null);

  const lastVisit = useLastVisit();
  const { open, toggle } = useOpenSections();

  // OutreachTab keeps its own fetch for the table it renders. This second,
  // page-level read of the same admin-gated function is what lets the Partners
  // tiles, the pipeline bar and the visit-bar deltas exist without reaching
  // into that component's state.
  const [outreach, setOutreach] = useState<OutreachSummary | null>(null);
  const [outreachLoading, setOutreachLoading] = useState(true);
  const [outreachError, setOutreachError] = useState<string | null>(null);

  const isAdmin = !authLoading && !!user && isAdminEmail(user.email);

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

  const fetchOutreach = useCallback(async () => {
    setOutreachLoading(true);
    setOutreachError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const r = await fetch(`${supabaseUrl}/functions/v1/ops-outreach`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        },
        body: JSON.stringify({ action: 'list' }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      const data = await r.json();
      setOutreach({
        prospects: data.prospects ?? [],
        withClick: data.counters?.prospects_with_click ?? 0,
        clicksToday: data.counters?.clicks_today ?? 0,
      });
    } catch (e) {
      setOutreachError(e instanceof Error ? e.message : 'Could not load outreach data');
    } finally {
      setOutreachLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchFeed();
  }, [isAdmin, fetchFeed]);

  useEffect(() => {
    if (isAdmin) fetchOutreach();
  }, [isAdmin, fetchOutreach]);

  // Auto-refresh every 5 minutes, but skip while the tab is hidden so we don't
  // poll in the background. The pull is light (cached AI + small queries).
  useEffect(() => {
    if (!isAdmin) return;
    const id = setInterval(() => {
      if (!document.hidden) fetchFeed();
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [isAdmin, fetchFeed]);

  // Resolve a support ticket / dismiss any other item. Optimistically removes
  // it from the feed, then tells the edge function to persist it.
  const dismissItem = useCallback(
    async (key: string) => {
      setFeed((prev) =>
        prev ? { ...prev, items: prev.items.filter((i) => i.key !== key) } : prev,
      );
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
          body: JSON.stringify({ action: 'dismiss', item_key: key }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        toast.success(key.startsWith('support:') ? 'Marked resolved' : 'Dismissed');
      } catch {
        toast.error('Could not save — refreshing');
        fetchFeed();
      }
    },
    [fetchFeed],
  );

  // After login, Supabase routes new/returning users elsewhere, so stash the
  // intended destination and send them straight back to /ops afterwards.
  const goToLogin = () => {
    try {
      localStorage.setItem('post_auth_redirect', '/ops');
    } catch {
      /* ignore */
    }
    window.location.href = '/auth';
  };

  const switchAccount = async () => {
    await supabase.auth.signOut();
    goToLogin();
  };

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
        <div className="max-w-sm">
          <div className="text-lg font-semibold text-white/[0.88] mb-2">Sign in required</div>
          <div className="text-sm text-white/60 mb-5">
            The ops dashboard is for Cairnly admins. Sign in to continue.
          </div>
          <Button onClick={goToLogin} className="bg-atlas-teal hover:bg-atlas-teal/90 text-white">
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  // Logged in, but not on an allowlisted admin account
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-4">
        <div className="max-w-sm">
          <div className="text-lg font-semibold text-white/[0.88] mb-2">Access restricted</div>
          <div className="text-sm text-white/60 mb-1">This page is for Cairnly admins only.</div>
          <div className="text-xs text-white/50 mb-5">
            You're signed in as <span className="text-white/70">{user.email}</span> — that account isn't on the admin list.
          </div>
          <Button onClick={switchAccount} className="bg-atlas-teal hover:bg-atlas-teal/90 text-white">
            Sign in with a different account
          </Button>
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
  const traffic = feed?.traffic ?? null;
  const stalled = people.filter(
    (p) => p.stage !== 'done' && Date.now() - new Date(p.last_activity_at).getTime() > 3 * 24 * 60 * 60 * 1000,
  );
  const stuckCount = stalled.length;

  // ── Outreach, summarised ────────────────────────────────────────────────
  const prospects = outreach?.prospects ?? [];
  const contacted = prospects.filter((p) => p.status !== 'nog_niet_benaderd').length;
  const awaitingReply = prospects.filter((p) => p.needs_reply).length;
  const warmCount = prospects.filter((p) => isWarm(p)).length;
  const linkedPartners = new Set(prospects.filter((p) => p.partner_slug).map((p) => p.partner_slug)).size;
  const codesIssued = prospects.reduce((n, p) => n + (p.codes_issued ?? 0), 0);
  const codesClaimed = prospects.reduce((n, p) => n + (p.codes_claimed ?? 0), 0);

  // ── What changed since the last visit ───────────────────────────────────
  const newerThan = (iso: string | null | undefined) =>
    !!(lastVisit && iso && new Date(iso).getTime() > new Date(lastVisit).getTime());

  const newBlockers = since(blockers, lastVisit);
  const newN8n = since(n8nErrors, lastVisit).filter((i) => i.severity !== 'blocker');
  const newSupport = since(support, lastVisit).filter((i) => i.severity !== 'blocker');
  const newSignups = lastVisit
    ? people.filter((p) => newerThan(p.signed_up_at)).length
    : 0;
  const newReplies = prospects.filter((p) => p.laatste_mail_richting === 'in' && newerThan(p.laatste_mail_op)).length;
  const newOpens = prospects.filter((p) => newerThan(p.laatste_bevestigde_klik)).length;

  const deltas: Delta[] = [];
  if (newBlockers.length)
    deltas.push({ label: `${newBlockers.length} new blocker${newBlockers.length === 1 ? '' : 's'}`, color: '#F87171', onClick: () => setActiveTab('platform') });
  if (awaitingReply)
    deltas.push({ label: `${awaitingReply} waiting on you`, color: '#EFBE48', onClick: () => setActiveTab('partners') });
  if (newReplies)
    deltas.push({ label: `${newReplies} replied`, color: '#EFBE48', onClick: () => setActiveTab('partners') });
  if (newOpens)
    deltas.push({ label: `${newOpens} new demo open${newOpens === 1 ? '' : 's'}`, color: '#27A1A1', onClick: () => setActiveTab('partners') });
  if (newSignups)
    deltas.push({ label: `${newSignups} new signup${newSignups === 1 ? '' : 's'}`, color: '#3989AF', onClick: () => setActiveTab('stats') });
  if (newN8n.length)
    deltas.push({ label: `${newN8n.length} n8n error${newN8n.length === 1 ? '' : 's'}`, color: '#FBBF24', onClick: () => setActiveTab('platform') });
  if (newSupport.length)
    deltas.push({ label: `${newSupport.length} support ticket${newSupport.length === 1 ? '' : 's'}`, color: '#7FBCD9', onClick: () => setActiveTab('platform') });

  const openBlockers = () => {
    setActiveTab('platform');
    if (!open.blockers) toggle('blockers');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const platformBadge = blockers.length > 0 ? blockers.length : n8nErrors.length;

  return (
    <div className="relative min-h-screen" style={{ background: '#122E3B' }}>
      {/* Same treatment as the assessment dashboard: a photo under a heavy
          gradient, fixed to the viewport so it doesn't rescale as sections
          expand. Panels sit on it instead of being holes in it. */}
      <div
        aria-hidden
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(33,63,79,0.72) 0%, rgba(18,46,59,0.90) 46%, #122E3B 100%), url(${OPS_BG_URL})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
        }}
      />

      <div className="relative z-10 text-white/[0.88] pb-16">
        <OpsTopBar
          lastFetched={lastFetched}
          newAnalyzed={feed?.new_analyzed ?? 0}
          loading={loading}
          onRefresh={fetchFeed}
        />

        <div className="max-w-[1320px] mx-auto px-4 sm:px-8">
          {error && (
            <div className="mt-6 flex items-start gap-2 rounded-[18px] border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-300">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {loading && !feed && (
            <div className="space-y-4 mt-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className={`h-28 ${GLASS} animate-pulse`} />
              ))}
            </div>
          )}

          {feed && (
            <div className="space-y-4 pt-6">
              {/* The only thing allowed above the tabs, and only when it exists. */}
              <BlockerBand blockers={blockers} newCount={newBlockers.length} onOpen={openBlockers} />

              <VisitBar since={lastVisit} deltas={deltas} />

              <div className="pt-1">
                <MainTabs
                  active={activeTab}
                  onSelect={setActiveTab}
                  partnersBadge={awaitingReply}
                  platformBadge={platformBadge}
                  platformUrgent={blockers.length > 0}
                />
              </div>

              {/* ══ PARTNERS ══════════════════════════════════════════════ */}
              {activeTab === 'partners' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatTile
                      label="Contacted"
                      value={outreachLoading ? '—' : contacted}
                      sub={`of ${prospects.length} agencies`}
                    />
                    <StatTile
                      label="Demo opened"
                      value={outreachLoading ? '—' : (outreach?.withClick ?? 0)}
                      sub={contacted > 0 ? `${Math.round((100 * (outreach?.withClick ?? 0)) / contacted)}% of those contacted` : 'nobody contacted yet'}
                      delta={newOpens ? `+${newOpens}` : undefined}
                    />
                    <StatTile
                      label="Waiting on you"
                      value={outreachLoading ? '—' : awaitingReply}
                      sub="they wrote last"
                      tone="gold"
                    />
                    <StatTile
                      label="Linked partners"
                      value={outreachLoading ? '—' : linkedPartners}
                      sub={`${codesIssued} codes, ${codesClaimed} used`}
                    />
                  </div>

                  <SectionCard
                    id="outreach"
                    title="Outreach"
                    subtitle={
                      outreachError
                        ? outreachError
                        : `${prospects.length} agencies · ${awaitingReply} waiting on a reply · ${warmCount} opened but not followed up`
                    }
                    pills={
                      <>
                        {awaitingReply > 0 && <CountPill n={awaitingReply} tone="gold" />}
                        {warmCount > 0 && <CountPill n={warmCount} tone="teal" />}
                      </>
                    }
                    open={open.outreach}
                    onToggle={toggle}
                  >
                    {prospects.length > 0 && (
                      <div className="mb-5">
                        <PipelineBar prospects={prospects} />
                      </div>
                    )}
                    <OutreachTab
                      onCreatePartner={(d) => {
                        setPartnerDraft(d);
                        if (!open.partners) toggle('partners');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    />
                  </SectionCard>

                  <SectionCard
                    id="partners"
                    title="Partners"
                    subtitle="Onboard a white-label partner end to end: save their name and logo, mint a batch of codes, and copy the signup links straight into an email. One code is one person."
                    open={open.partners}
                    onToggle={toggle}
                  >
                    <PartnersTab draft={partnerDraft} onDraftConsumed={() => setPartnerDraft(null)} />
                  </SectionCard>
                </div>
              )}

              {/* ══ PLATFORM ══════════════════════════════════════════════ */}
              {activeTab === 'platform' && (
                <div className="space-y-4">
                  {blockers.length === 0 && (
                    <div className={`${GLASS} border-emerald-400/20 bg-emerald-500/[0.07] px-6 py-4 flex flex-wrap items-center gap-3`}>
                      <CheckCircle2 size={19} className="text-emerald-400 shrink-0" />
                      <span className="text-sm text-white/[0.86] font-medium">No blockers.</span>
                      <span className="text-[13px] text-white/55">
                        {n8nErrors.length > 0
                          ? `The ${n8nErrors.length} n8n error${n8nErrors.length === 1 ? '' : 's'} below didn't hit a user.`
                          : 'Nothing is failing right now.'}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <DeployStrip deploy={feed.deploy} />
                    <div className="lg:col-span-2">
                      <ProviderBanner status={feed.provider_status} />
                    </div>
                  </div>

                  {/* Only exists while there is something to show. */}
                  {blockers.length > 0 && (
                    <SectionCard
                      id="blockers"
                      title="Blockers"
                      subtitle={newestLine(blockers)}
                      pills={<CountPill n={blockers.length} tone="red" />}
                      open={open.blockers}
                      onToggle={toggle}
                      tone="blocker"
                    >
                      <Feed items={blockers} onDismiss={dismissItem} />
                    </SectionCard>
                  )}

                  <SectionCard
                    id="n8n"
                    title="n8n errors"
                    subtitle={newestLine(n8nErrors) ?? 'No failed executions.'}
                    pills={n8nErrors.length > 0 ? <CountPill n={n8nErrors.length} tone="amber" /> : undefined}
                    open={open.n8n}
                    onToggle={toggle}
                  >
                    <div className="mb-4 flex items-center justify-between gap-2 text-xs text-white/60">
                      <span>Live failed executions from n8n. Each card deep-links to its run.</span>
                      <a
                        href={`${N8N_BASE}/home/executions`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[#2ABFBF] hover:underline shrink-0"
                      >
                        All executions <ExternalLink size={11} />
                      </a>
                    </div>
                    <Feed items={n8nErrors} onDismiss={dismissItem} />
                  </SectionCard>

                  <SectionCard
                    id="support"
                    title="Support"
                    subtitle={newestLine(support) ?? 'No open tickets.'}
                    pills={support.length > 0 ? <CountPill n={support.length} tone="blue" /> : undefined}
                    open={open.support}
                    onToggle={toggle}
                  >
                    <Feed items={support} onDismiss={dismissItem} />
                  </SectionCard>

                  <SectionCard
                    id="feedback"
                    title="Chat feedback"
                    subtitle={newestLine(feedback) ?? 'No ratings yet.'}
                    pills={feedback.length > 0 ? <CountPill n={feedback.length} tone="quiet" /> : undefined}
                    open={open.feedback}
                    onToggle={toggle}
                  >
                    <div className="mb-4 text-xs text-white/60">
                      Mid-chat quality ratings submitted by users after each report chapter. Useful for spotting which sections consistently get poor marks.
                    </div>
                    <Feed items={feedback} onDismiss={dismissItem} />
                  </SectionCard>

                  <SectionCard
                    id="misses"
                    title="Assessment misses"
                    subtitle={newestLine(misses) ?? 'No corrections logged.'}
                    pills={misses.length > 0 ? <CountPill n={misses.length} tone="quiet" /> : undefined}
                    open={open.misses}
                    onToggle={toggle}
                  >
                    <div className="mb-4 text-xs text-white/60">
                      <strong className="text-white/75">How to read this:</strong> Category 2 (major) = WF6 significantly reworked the AI output based on user pushback. Category 1 (minor) = small refinements. The feedback text is WF6&apos;s own summary of what changed.
                    </div>
                    <Feed items={misses} onDismiss={dismissItem} />
                  </SectionCard>

                  <SectionCard
                    id="admin"
                    title="Admin tools"
                    subtitle="Re-run a report for a user from their saved answers."
                    pills={<Wrench size={15} className="text-white/55" />}
                    open={!!open.admin}
                    onToggle={toggle}
                  >
                    <RerunReportCard />
                  </SectionCard>
                </div>
              )}

              {/* ══ STATS ═════════════════════════════════════════════════ */}
              {activeTab === 'stats' && (
                <div className="space-y-4">
                  {/* Traffic and people get the room; usage and marketing wait below. */}
                  <div className={`${GLASS} px-6 py-6`}>
                    <div className={EYEBROW}>Traffic</div>
                    <div className="mt-4">
                      <TrafficPanel traffic={feed.traffic} funnel={feed.funnel ?? null} />
                    </div>
                  </div>

                  <div className={`${GLASS} px-6 py-6`}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className={EYEBROW}>People</div>
                      <div className="text-[13px] text-white/60">
                        <strong className="text-white/80">{newThisWeek}</strong> joined this week
                        {stuckCount > 0 && <> · <strong className="text-amber-300">{stuckCount}</strong> stalled 3+ days</>}
                      </div>
                    </div>
                    <div className="text-xs text-white/55 mt-2">
                      Everyone who signed up in the last 30 days and where they are in the journey. Identified by first name + country only.
                    </div>
                    <div className="mt-4">
                      <PeoplePanel people={people} />
                    </div>
                  </div>

                  <SectionCard
                    id="usage"
                    title="Usage & cost"
                    subtitle={
                      feed.n8n_usage
                        ? `n8n ${feed.n8n_usage.executions_this_month.toLocaleString()} / ${feed.n8n_usage.limit.toLocaleString()} runs this month`
                        : 'n8n usage unavailable.'
                    }
                    open={open.usage}
                    onToggle={toggle}
                  >
                    <UsagePanel usage={feed.n8n_usage} spend={feed.ai_spend ?? []} />
                  </SectionCard>

                  <SectionCard
                    id="marketing"
                    title="Marketing"
                    subtitle="LinkedIn posts logged by hand, with reach snapshots read against the site traffic above."
                    open={open.marketing}
                    onToggle={toggle}
                  >
                    <MarketingTab />
                  </SectionCard>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
