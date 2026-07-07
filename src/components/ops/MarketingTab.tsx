// MarketingTab — LinkedIn reach for the ops dashboard (cairnly.io/ops).
//
// Self-contained: fetches from and writes to the admin-gated ops-marketing edge
// function (the browser never touches the marketing tables directly). Covers the
// full brief in one tab:
//   • Log      — every post (verbatim body + metadata), fast stat entry as
//                snapshots over time, comment-sentiment + gut-read pills.
//   • Overlay  — post-publish markers drawn on the real site-traffic timeline,
//                so an uptick in the hours after a post is visible by eye.
//   • Patterns — outcome (reach / gut read) broken down by post type, hook,
//                image, author, so patterns surface instead of a stat wall.
//   • Export   — CSV of the whole log + latest stats.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, RefreshCw, Plus, Download, Trash2, Pencil, ChevronDown, ChevronRight, Image as ImageIcon, Sparkles } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Snapshot {
  id: string;
  post_id: string;
  captured_at: string;
  impressions: number;
  reactions: number;
  comments: number;
  reposts: number;
}

interface Post {
  id: string;
  created_at: string;
  updated_at: string;
  posted_at: string | null;
  status: 'draft' | 'scheduled' | 'posted';
  author: string;
  profile: 'personal' | 'company';
  post_type: string | null;
  hook_style: string | null;
  has_image: boolean;
  image_type: string | null;
  is_series: boolean;
  series_name: string | null;
  body: string;
  comment_sentiment: 'positive' | 'mixed' | 'critical' | 'quiet' | null;
  gut_read: 'win' | 'neutral' | 'miss' | null;
  notes: string | null;
  snapshots: Snapshot[];
  latest: Snapshot | null;
}

interface TrafficPoint {
  bucket: string;
  visits: number;
  pageviews: number;
}

interface MarketingData {
  posts: Post[];
  traffic_series: TrafficPoint[];
}

// ─── Presets & labels ─────────────────────────────────────────────────────────

const POST_TYPES: Array<{ value: string; label: string }> = [
  { value: 'personal_story', label: 'Personal story' },
  { value: 'opinion', label: 'Opinion' },
  { value: 'behind_the_build', label: 'Behind the build' },
  { value: 'career_data', label: 'Career data / teardown' },
  { value: 'launch_series', label: 'Launch series' },
  { value: 'success_story', label: 'Success story' },
];
const typeLabel = (v: string | null) =>
  POST_TYPES.find((t) => t.value === v)?.label ?? (v ?? '—');

const SENTIMENTS: Array<{ value: NonNullable<Post['comment_sentiment']>; label: string; cls: string }> = [
  { value: 'positive', label: '😊 Positive', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  { value: 'mixed', label: '😐 Mixed', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  { value: 'critical', label: '😬 Critical', cls: 'bg-red-500/20 text-red-300 border-red-500/40' },
  { value: 'quiet', label: '🤫 Quiet', cls: 'bg-white/10 text-gray-400 border-white/20' },
];
const GUT_READS: Array<{ value: NonNullable<Post['gut_read']>; label: string; cls: string }> = [
  { value: 'win', label: '🏆 Win', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  { value: 'neutral', label: '➖ Neutral', cls: 'bg-white/10 text-gray-400 border-white/20' },
  { value: 'miss', label: '📉 Miss', cls: 'bg-red-500/20 text-red-300 border-red-500/40' },
];

const STATUS_CLS: Record<Post['status'], string> = {
  draft: 'bg-white/10 text-gray-400 border-white/20',
  scheduled: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  posted: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
};

// ─── Shared styles ────────────────────────────────────────────────────────────

const card = 'rounded-lg border border-white/10 bg-black/25';
const input =
  'bg-black/40 border border-white/10 rounded px-2 py-1.5 text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-atlas-teal/60 w-full';
const label = 'text-[11px] uppercase tracking-wider text-gray-500 mb-1 block';

function fmtDate(iso: string | null, withTime = false): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function callMarketing(body: Record<string, unknown>): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const r = await fetch(`${url}/functions/v1/ops-marketing`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const b = await r.json().catch(() => ({}));
    throw new Error(b.error ?? `HTTP ${r.status}`);
  }
  return r.json();
}

// ─── Post add / edit form ─────────────────────────────────────────────────────

function PostForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: Partial<Post> | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState<Partial<Post>>(() => ({
    status: 'posted',
    author: 'Sjoerd',
    profile: 'personal',
    // Most posts carry an image, and the dashboard is used the day a post goes
    // live — so pre-fill both rather than making Sjoerd set them every time.
    has_image: true,
    is_series: false,
    body: '',
    posted_at: new Date().toISOString(),
    ...initial,
  }));
  const [saving, setSaving] = useState(false);
  const [classifying, setClassifying] = useState(false);

  const set = (k: keyof Post, v: unknown) => setF((prev) => ({ ...prev, [k]: v }));

  // Ask Haiku to read the pasted post and guess its type + hook style, so those
  // don't have to be tagged by hand. Only fills empty-ish fields aren't forced —
  // the returned values overwrite, but everything stays editable afterwards.
  const autofill = async () => {
    if (!f.body?.trim()) {
      toast.error('Paste the post text first');
      return;
    }
    setClassifying(true);
    try {
      const r = await callMarketing({ action: 'classify', text: f.body });
      setF((prev) => ({
        ...prev,
        post_type: r.post_type ?? prev.post_type,
        hook_style: r.hook_style ?? prev.hook_style,
      }));
      if (r.post_type || r.hook_style) toast.success('Filled type & hook from the text');
      else toast.message('Nothing confident to fill — tag it manually');
    } catch (e: any) {
      toast.error(e.message ?? 'Could not auto-fill');
    } finally {
      setClassifying(false);
    }
  };

  // datetime-local wants "YYYY-MM-DDTHH:mm" in local time.
  const localDT = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const save = async () => {
    setSaving(true);
    try {
      await callMarketing({ action: 'post_upsert', post: f });
      toast.success(initial?.id ? 'Post updated' : 'Post added');
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`${card} p-4 space-y-3`}>
      <div className="text-sm font-semibold text-gray-200">{initial?.id ? 'Edit post' : 'Add post'}</div>

      <div>
        <label className={label}>Verbatim post text</label>
        <textarea
          className={`${input} min-h-[120px] font-mono text-xs leading-relaxed`}
          placeholder="Paste the actual live LinkedIn post, word for word…"
          value={f.body ?? ''}
          onChange={(e) => set('body', e.target.value)}
        />
        <button
          type="button"
          onClick={autofill}
          disabled={classifying}
          className="mt-2 text-xs text-atlas-teal hover:underline inline-flex items-center gap-1 disabled:opacity-50"
        >
          {classifying ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          Auto-fill type &amp; hook from the text
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label className={label}>Post type</label>
          <select className={input} value={f.post_type ?? ''} onChange={(e) => set('post_type', e.target.value || null)}>
            <option value="">— pick —</option>
            {POST_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Status</label>
          <select className={input} value={f.status ?? 'posted'} onChange={(e) => set('status', e.target.value)}>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="posted">Posted</option>
          </select>
        </div>
        <div>
          <label className={label}>Posted / scheduled at</label>
          <input
            type="datetime-local"
            className={input}
            value={localDT(f.posted_at)}
            onChange={(e) => set('posted_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
          />
        </div>
        <div>
          <label className={label}>Author</label>
          <input className={input} value={f.author ?? ''} onChange={(e) => set('author', e.target.value)} />
        </div>
        <div>
          <label className={label}>Profile</label>
          <select className={input} value={f.profile ?? 'personal'} onChange={(e) => set('profile', e.target.value)}>
            <option value="personal">Personal</option>
            <option value="company">Company page</option>
          </select>
        </div>
        <div>
          <label className={label}>Hook style</label>
          <input className={input} placeholder="e.g. bold claim, question" value={f.hook_style ?? ''} onChange={(e) => set('hook_style', e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input type="checkbox" checked={!!f.has_image} onChange={(e) => set('has_image', e.target.checked)} />
          Has image
        </label>
        <div>
          <label className={label}>Image type</label>
          <input className={input} placeholder="photo, chart…" value={f.image_type ?? ''} disabled={!f.has_image} onChange={(e) => set('image_type', e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input type="checkbox" checked={!!f.is_series} onChange={(e) => set('is_series', e.target.checked)} />
          Part of a series
        </label>
        <div>
          <label className={label}>Series name</label>
          <input className={input} disabled={!f.is_series} value={f.series_name ?? ''} onChange={(e) => set('series_name', e.target.value)} />
        </div>
      </div>

      <div>
        <label className={label}>Notes (optional)</label>
        <input className={input} value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={save}
          disabled={saving}
          className="px-3 py-1.5 rounded bg-atlas-teal/80 hover:bg-atlas-teal text-black text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {saving && <Loader2 size={13} className="animate-spin" />}
          {initial?.id ? 'Save changes' : 'Add post'}
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 rounded border border-white/10 text-gray-400 hover:text-gray-200 text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Stat snapshot entry ──────────────────────────────────────────────────────

function StatEntry({ postId, onSaved }: { postId: string; onSaved: () => void }) {
  const [v, setV] = useState({ impressions: '', reactions: '', comments: '', reposts: '' });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await callMarketing({
        action: 'stat_snapshot',
        post_id: postId,
        impressions: Number(v.impressions) || 0,
        reactions: Number(v.reactions) || 0,
        comments: Number(v.comments) || 0,
        reposts: Number(v.reposts) || 0,
      });
      toast.success('Snapshot saved');
      setV({ impressions: '', reactions: '', comments: '', reposts: '' });
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const field = (k: keyof typeof v, ph: string) => (
    <input
      type="number"
      min={0}
      className={`${input} w-24`}
      placeholder={ph}
      value={v[k]}
      onChange={(e) => setV((p) => ({ ...p, [k]: e.target.value }))}
    />
  );

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div><label className={label}>👁 Impr.</label>{field('impressions', '0')}</div>
      <div><label className={label}>👍 React.</label>{field('reactions', '0')}</div>
      <div><label className={label}>💬 Comm.</label>{field('comments', '0')}</div>
      <div><label className={label}>🔁 Rep.</label>{field('reposts', '0')}</div>
      <button
        onClick={save}
        disabled={saving}
        className="px-3 py-1.5 rounded bg-atlas-teal/80 hover:bg-atlas-teal text-black text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"
      >
        {saving && <Loader2 size={13} className="animate-spin" />}
        Add snapshot
      </button>
    </div>
  );
}

// ─── Selectable pill group ────────────────────────────────────────────────────

function PillGroup<T extends string>({
  value,
  options,
  onPick,
}: {
  value: T | null;
  options: Array<{ value: T; label: string; cls: string }>;
  onPick: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onPick(o.value)}
          className={`text-[11px] px-2 py-0.5 rounded-full border transition-all ${
            value === o.value ? o.cls : 'bg-black/20 text-gray-500 border-white/10 hover:border-white/20'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── One post card ────────────────────────────────────────────────────────────

function PostCard({ post, onChanged, onEdit }: { post: Post; onChanged: () => void; onEdit: () => void }) {
  const [open, setOpen] = useState(false);

  const setField = async (patch: Partial<Post>) => {
    try {
      await callMarketing({ action: 'post_upsert', post: { id: post.id, ...patch } });
      onChanged();
    } catch (e: any) {
      toast.error(e.message ?? 'Could not update');
    }
  };

  const del = async () => {
    if (!confirm('Delete this post and all its snapshots?')) return;
    try {
      await callMarketing({ action: 'post_delete', id: post.id });
      toast.success('Post deleted');
      onChanged();
    } catch (e: any) {
      toast.error(e.message ?? 'Could not delete');
    }
  };

  const delSnapshot = async (id: string) => {
    try {
      await callMarketing({ action: 'stat_delete', id });
      onChanged();
    } catch (e: any) {
      toast.error(e.message ?? 'Could not delete snapshot');
    }
  };

  const L = post.latest;
  const maxImpr = Math.max(1, ...post.snapshots.map((s) => s.impressions));
  const preview = post.body.length > 140 ? `${post.body.slice(0, 140)}…` : post.body;

  return (
    <div className={`${card} p-3`}>
      <div className="flex items-start justify-between gap-3">
        <button onClick={() => setOpen((o) => !o)} className="flex items-start gap-2 text-left min-w-0 flex-1">
          {open ? <ChevronDown size={15} className="text-gray-500 mt-0.5 shrink-0" /> : <ChevronRight size={15} className="text-gray-500 mt-0.5 shrink-0" />}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span className={`text-[11px] px-2 py-0.5 rounded-full border ${STATUS_CLS[post.status]}`}>{post.status}</span>
              <span className="text-xs font-semibold text-gray-200">{typeLabel(post.post_type)}</span>
              {post.has_image && <ImageIcon size={12} className="text-gray-500" />}
              {post.is_series && <span className="text-[10px] text-atlas-teal">series{post.series_name ? `: ${post.series_name}` : ''}</span>}
            </div>
            <div className="text-xs text-gray-500">
              {post.author} · {post.profile === 'company' ? 'Company' : 'Personal'} · {fmtDate(post.posted_at, true)}
            </div>
            {!open && <div className="text-xs text-gray-400 mt-1 line-clamp-1">{preview || <span className="text-gray-700">no body pasted yet</span>}</div>}
          </div>
        </button>

        <div className="text-right shrink-0">
          {L ? (
            <div className="text-xs text-gray-300 tabular-nums">
              <span className="text-gray-100 font-semibold">{L.impressions.toLocaleString()}</span> 👁
            </div>
          ) : (
            <div className="text-[11px] text-gray-600">no stats</div>
          )}
          {L && (
            <div className="text-[11px] text-gray-500 tabular-nums">
              {L.reactions} 👍 · {L.comments} 💬 · {L.reposts} 🔁
            </div>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-3 pl-6 space-y-4">
          {/* Verbatim body */}
          {post.body ? (
            <pre className="whitespace-pre-wrap font-mono text-xs text-gray-300 bg-black/30 rounded p-3 border border-white/5 max-h-64 overflow-auto">{post.body}</pre>
          ) : (
            <div className="text-xs text-gray-600 italic">No post text pasted yet — hit edit to add it.</div>
          )}

          {/* Soft calls */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <div className={label}>Comment sentiment</div>
              <PillGroup value={post.comment_sentiment} options={SENTIMENTS} onPick={(v) => setField({ comment_sentiment: v })} />
            </div>
            <div>
              <div className={label}>Gut read</div>
              <PillGroup value={post.gut_read} options={GUT_READS} onPick={(v) => setField({ gut_read: v })} />
            </div>
          </div>

          {/* Snapshot history */}
          {post.snapshots.length > 0 && (
            <div>
              <div className={label}>Reach over time ({post.snapshots.length} snapshot{post.snapshots.length === 1 ? '' : 's'})</div>
              <div className="space-y-1">
                {post.snapshots.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 text-xs group">
                    <span className="text-gray-500 w-24 shrink-0">{fmtDate(s.captured_at, true)}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden min-w-[40px]">
                      <div className="h-full bg-atlas-teal/60" style={{ width: `${(s.impressions / maxImpr) * 100}%` }} />
                    </div>
                    <span className="text-gray-300 tabular-nums w-40 text-right shrink-0">
                      {s.impressions.toLocaleString()} 👁 · {s.reactions} 👍 · {s.comments} 💬 · {s.reposts} 🔁
                    </span>
                    <button onClick={() => delSnapshot(s.id)} className="text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New snapshot */}
          <div>
            <div className={label}>Add today's numbers (kept as a snapshot, doesn't overwrite)</div>
            <StatEntry postId={post.id} onSaved={onChanged} />
          </div>

          {post.notes && <div className="text-xs text-gray-500">📝 {post.notes}</div>}

          <div className="flex gap-2 pt-1">
            <button onClick={onEdit} className="text-xs text-gray-400 hover:text-gray-200 inline-flex items-center gap-1">
              <Pencil size={12} /> Edit
            </button>
            <button onClick={del} className="text-xs text-gray-600 hover:text-red-400 inline-flex items-center gap-1">
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Traffic overlay ──────────────────────────────────────────────────────────

function TrafficOverlay({ series, posts }: { series: TrafficPoint[]; posts: Post[] }) {
  const data = useMemo(
    () => series.map((p) => ({ t: new Date(p.bucket).getTime(), visits: p.visits, pageviews: p.pageviews })),
    [series],
  );

  const markers = useMemo(() => {
    if (data.length === 0) return [];
    const min = data[0].t;
    const max = data[data.length - 1].t;
    return posts
      .filter((p) => p.posted_at && p.status !== 'draft')
      .map((p) => ({ t: new Date(p.posted_at as string).getTime(), post: p }))
      .filter((m) => m.t >= min && m.t <= max);
  }, [data, posts]);

  if (data.length === 0) {
    return (
      <div className={`${card} py-14 text-center text-gray-600`}>
        <div className="text-sm">No traffic in the last 14 days yet</div>
        <div className="text-xs text-gray-700 mt-1">Once visits come in, post markers will overlay here.</div>
      </div>
    );
  }

  return (
    <div className={`${card} p-4`}>
      <div className="text-xs text-gray-500 mb-3">
        Site visits per hour (last 14 days). Vertical lines mark when a post went live — look for an uptick in the hours after.
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="visitsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="t"
            type="number"
            domain={['dataMin', 'dataMax']}
            scale="time"
            tickFormatter={(t) => new Date(t).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            stroke="rgba(255,255,255,0.1)"
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} stroke="rgba(255,255,255,0.1)" allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: '#0b0f14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
            labelFormatter={(t) => new Date(t as number).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            formatter={(val: number, name) => [val, name === 'visits' ? 'visits' : 'pageviews']}
          />
          <Area type="monotone" dataKey="visits" stroke="#2dd4bf" strokeWidth={2} fill="url(#visitsFill)" />
          {markers.map((m) => (
            <ReferenceLine
              key={m.post.id}
              x={m.t}
              stroke="#f59e0b"
              strokeDasharray="4 3"
              strokeOpacity={0.8}
              label={{ value: '▲', position: 'top', fill: '#f59e0b', fontSize: 10 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>

      {markers.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {markers.map((m) => (
            <span key={m.post.id} className="text-[11px] px-2 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-200">
              ▲ {typeLabel(m.post.post_type)} · {fmtDate(m.post.posted_at, true)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Patterns breakdown ───────────────────────────────────────────────────────

type Dimension = 'post_type' | 'hook_style' | 'has_image' | 'author';

function Patterns({ posts }: { posts: Post[] }) {
  const [dim, setDim] = useState<Dimension>('post_type');

  const groups = useMemo(() => {
    const withStats = posts.filter((p) => p.status === 'posted');
    const keyOf = (p: Post): string => {
      switch (dim) {
        case 'post_type': return typeLabel(p.post_type);
        case 'hook_style': return p.hook_style || '—';
        case 'has_image': return p.has_image ? 'With image' : 'No image';
        case 'author': return p.author;
      }
    };
    const map = new Map<string, Post[]>();
    for (const p of withStats) {
      const k = keyOf(p);
      map.set(k, [...(map.get(k) ?? []), p]);
    }
    return Array.from(map.entries()).map(([key, ps]) => {
      const withLatest = ps.filter((p) => p.latest);
      const avgImpr = withLatest.length
        ? Math.round(withLatest.reduce((s, p) => s + (p.latest?.impressions ?? 0), 0) / withLatest.length)
        : 0;
      const avgReact = withLatest.length
        ? Math.round(withLatest.reduce((s, p) => s + (p.latest?.reactions ?? 0), 0) / withLatest.length)
        : 0;
      const wins = ps.filter((p) => p.gut_read === 'win').length;
      const misses = ps.filter((p) => p.gut_read === 'miss').length;
      return { key, count: ps.length, avgImpr, avgReact, wins, misses };
    }).sort((a, b) => b.avgImpr - a.avgImpr);
  }, [posts, dim]);

  const maxImpr = Math.max(1, ...groups.map((g) => g.avgImpr));

  const DIMS: Array<{ value: Dimension; label: string }> = [
    { value: 'post_type', label: 'Post type' },
    { value: 'hook_style', label: 'Hook style' },
    { value: 'has_image', label: 'Image' },
    { value: 'author', label: 'Author' },
  ];

  return (
    <div className={`${card} p-4 space-y-4`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500">Break outcome down by</span>
        {DIMS.map((d) => (
          <button
            key={d.value}
            onClick={() => setDim(d.value)}
            className={`text-xs px-2.5 py-1 rounded-full border ${dim === d.value ? 'bg-atlas-teal/20 text-atlas-teal border-atlas-teal/40' : 'border-white/10 text-gray-400 hover:text-gray-200'}`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <div className="text-sm text-gray-600 py-6 text-center">No posted posts with stats yet.</div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 text-[11px] uppercase tracking-wider text-gray-600 px-1">
            <span>Group</span><span className="text-right">Avg reach</span><span className="text-right">Avg react.</span><span className="text-right">Gut</span>
          </div>
          {groups.map((g) => (
            <div key={g.key} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-1">
              <div className="min-w-0">
                <div className="text-sm text-gray-200 truncate">{g.key} <span className="text-gray-600">· {g.count}</span></div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mt-1">
                  <div className="h-full bg-atlas-teal/60" style={{ width: `${(g.avgImpr / maxImpr) * 100}%` }} />
                </div>
              </div>
              <span className="text-sm text-gray-100 tabular-nums text-right">{g.avgImpr.toLocaleString()}</span>
              <span className="text-sm text-gray-400 tabular-nums text-right">{g.avgReact}</span>
              <span className="text-xs tabular-nums text-right whitespace-nowrap">
                <span className="text-emerald-400">{g.wins}</span>
                <span className="text-gray-700">/</span>
                <span className="text-red-400">{g.misses}</span>
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="text-[11px] text-gray-600">Reach = latest snapshot per post, averaged across the group. Gut = wins / misses.</div>
    </div>
  );
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCsv(posts: Post[]) {
  const cols = [
    'posted_at', 'status', 'author', 'profile', 'post_type', 'hook_style',
    'has_image', 'image_type', 'is_series', 'series_name',
    'comment_sentiment', 'gut_read',
    'latest_impressions', 'latest_reactions', 'latest_comments', 'latest_reposts',
    'snapshot_count', 'body',
  ];
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = posts.map((p) => [
    p.posted_at ?? '', p.status, p.author, p.profile, p.post_type ?? '', p.hook_style ?? '',
    p.has_image, p.image_type ?? '', p.is_series, p.series_name ?? '',
    p.comment_sentiment ?? '', p.gut_read ?? '',
    p.latest?.impressions ?? '', p.latest?.reactions ?? '', p.latest?.comments ?? '', p.latest?.reposts ?? '',
    p.snapshots.length, p.body,
  ].map(esc).join(','));
  const csv = [cols.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cairnly-marketing-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function MarketingTab() {
  const [data, setData] = useState<MarketingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'log' | 'overlay' | 'patterns'>('log');
  const [editing, setEditing] = useState<Partial<Post> | null | 'new'>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await callMarketing({});
      setData({ posts: d.posts ?? [], traffic_series: d.traffic_series ?? [] });
    } catch (e: any) {
      setError(e.message ?? 'Failed to load marketing data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const posts = data?.posts ?? [];

  const summary = useMemo(() => {
    const posted = posts.filter((p) => p.status === 'posted');
    const totalImpr = posted.reduce((s, p) => s + (p.latest?.impressions ?? 0), 0);
    const wins = posts.filter((p) => p.gut_read === 'win').length;
    return { count: posts.length, posted: posted.length, totalImpr, wins };
  }, [posts]);

  const afterSave = () => { setEditing(null); load(); };

  return (
    <div className="space-y-4">
      {/* Summary + actions */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap gap-3">
          {[
            ['Posts', summary.count],
            ['Posted', summary.posted],
            ['Total reach', summary.totalImpr.toLocaleString()],
            ['Wins', summary.wins],
          ].map(([l, v]) => (
            <div key={l} className={`${card} px-3 py-2`}>
              <div className="text-lg font-bold text-gray-100 tabular-nums leading-none">{v}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">{l}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setEditing('new')} className="px-3 py-1.5 rounded bg-atlas-teal/80 hover:bg-atlas-teal text-black text-sm font-semibold inline-flex items-center gap-1.5">
            <Plus size={14} /> Add post
          </button>
          <button onClick={() => exportCsv(posts)} disabled={!posts.length} className="px-3 py-1.5 rounded border border-white/10 text-gray-400 hover:text-gray-200 text-sm inline-flex items-center gap-1.5 disabled:opacity-40">
            <Download size={14} /> CSV
          </button>
          <button onClick={load} className="p-1.5 rounded border border-white/10 text-gray-400 hover:text-gray-200" title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Add / edit form */}
      {editing !== null && (
        <PostForm
          initial={editing === 'new' ? null : editing}
          onSaved={afterSave}
          onCancel={() => setEditing(null)}
        />
      )}

      {/* View switch */}
      <div className="flex gap-1 p-1 rounded-lg bg-black/25 border border-white/10 w-fit">
        {([['log', '📋 Log'], ['overlay', '📈 Traffic overlay'], ['patterns', '🔍 Patterns']] as const).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`text-xs px-3 py-1.5 rounded ${view === v ? 'bg-white/10 text-gray-100' : 'text-gray-500 hover:text-gray-300'}`}
          >
            {l}
          </button>
        ))}
      </div>

      {error && <div className={`${card} p-3 text-sm text-red-400`}>{error}</div>}

      {loading && !data ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-atlas-teal" /></div>
      ) : (
        <>
          {view === 'log' && (
            posts.length === 0 ? (
              <div className={`${card} py-14 text-center text-gray-600`}>
                <div className="text-sm">No posts logged yet</div>
                <div className="text-xs text-gray-700 mt-1">Hit “Add post”, paste the verbatim post, then add its numbers as they climb.</div>
              </div>
            ) : (
              <div className="space-y-2">
                {posts.map((p) => (
                  <PostCard key={p.id} post={p} onChanged={load} onEdit={() => setEditing(p)} />
                ))}
              </div>
            )
          )}
          {view === 'overlay' && <TrafficOverlay series={data?.traffic_series ?? []} posts={posts} />}
          {view === 'patterns' && <Patterns posts={posts} />}
        </>
      )}
    </div>
  );
}
