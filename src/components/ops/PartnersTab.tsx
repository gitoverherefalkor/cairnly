// PartnersTab — onboard a white-label partner without opening Supabase.
//
// Everything goes through the admin-gated ops-partners edge function: the
// browser never touches the `partners` table or the private partner-logos
// bucket. The logo is read here as base64 and posted on the JSON body; the
// function decodes it and uploads it with the service role.
//
// What the flow gives you: fill in the agency's name, pick their logo, save,
// then mint a batch of codes and copy the ready-made /p/:slug landing links straight into
// an email. The table shows how far each batch actually got.

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Upload, Copy, Check, Building2, RefreshCw } from 'lucide-react';

interface Partner {
  partner_id: string;
  slug: string;
  name: string;
  is_active: boolean;
  has_logo: boolean;
  powered_by_text: string | null;
  codes_issued: number;
  codes_claimed: number;
  surveys_started: number;
  expired_unused: number;
  reports_completed: number;
}

const MAX_LOGO_BYTES = 256 * 1024;

async function callPartners(body: Record<string, unknown>): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const r = await fetch(`${url}/functions/v1/ops-partners`, {
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

/** Read a File as bare base64 (no data: prefix). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('Could not read the file'));
    fr.onload = () => {
      const res = String(fr.result ?? '');
      const comma = res.indexOf(',');
      resolve(comma > -1 ? res.slice(comma + 1) : res);
    };
    fr.readAsDataURL(file);
  });
}

// ─── Add / edit form ─────────────────────────────────────────────────────────

function PartnerForm({ onSaved }: { onSaved: () => void }) {
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [poweredBy, setPoweredBy] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // Suggest a slug from the name so the common case needs no thought, but let
  // it be overridden: the slug is permanent (it is the storage path and the
  // future /p/:slug URL) while the display name is not.
  const [slugTouched, setSlugTouched] = useState(false);
  const suggestSlug = (v: string) =>
    v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

  const save = async () => {
    setErr(null);
    setOkMsg(null);
    if (file && file.size > MAX_LOGO_BYTES) {
      setErr(`Logo is ${Math.round(file.size / 1024)} KB. Limit is 256 KB — ask for an SVG or a smaller PNG.`);
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        action: 'save',
        slug: slugTouched ? slug : suggestSlug(name),
        name,
        poweredByText: poweredBy || null,
      };
      if (file) {
        payload.logoBase64 = await fileToBase64(file);
        payload.logoMime = file.type;
      }
      await callPartners(payload);
      setOkMsg('Saved.');
      setSlug(''); setName(''); setPoweredBy(''); setFile(null); setSlugTouched(false);
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-200">
        <Building2 className="h-4 w-4" /> Add or update a partner
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-gray-400">Name (shown on the report)</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Loopbaanbureau Noord"
            className="mt-1 bg-black/30 border-white/10"
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-400">Slug (permanent, used in the URL)</span>
          <Input
            value={slugTouched ? slug : suggestSlug(name)}
            onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }}
            placeholder="loopbaanbureau-noord"
            className="mt-1 bg-black/30 border-white/10 font-mono text-xs"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs text-gray-400">Credit line (optional — blank renders “Powered by Cairnly”)</span>
        <Input
          value={poweredBy}
          onChange={(e) => setPoweredBy(e.target.value)}
          placeholder=""
          className="mt-1 bg-black/30 border-white/10"
        />
      </label>

      <label className="block">
        <span className="text-xs text-gray-400">Logo — PNG or SVG, max 256 KB. Ask for SVG if they have it.</span>
        <input
          type="file"
          accept="image/png,image/svg+xml"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-xs text-gray-400 file:mr-3 file:rounded file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:text-gray-200"
        />
        {file && (
          <span className="mt-1 block text-[11px] text-gray-500">
            {file.name} · {Math.round(file.size / 1024)} KB
          </span>
        )}
      </label>

      {err && <div className="text-xs text-red-400">{err}</div>}
      {okMsg && <div className="text-xs text-emerald-400">{okMsg}</div>}

      <Button onClick={save} disabled={saving || !name} size="sm" className="bg-atlas-teal hover:bg-atlas-teal/90">
        {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
        Save partner
      </Button>
      <p className="text-[11px] text-gray-500">
        Saving an existing slug updates that partner. Leaving the logo empty keeps the current one.
      </p>
    </div>
  );
}

// ─── Mint codes ──────────────────────────────────────────────────────────────

function MintRow({ partner }: { partner: Partner }) {
  const [count, setCount] = useState('10');
  const [expires, setExpires] = useState('');
  const [lang, setLang] = useState<'nl' | 'en'>('nl');
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const mint = async () => {
    setErr(null);
    setBusy(true);
    try {
      const res = await callPartners({
        action: 'mint',
        slug: partner.slug,
        count: Number(count),
        lang,
        // A date input gives a bare date; make it end-of-day so a batch that
        // "expires on the 31st" is usable all of the 31st.
        expiresAt: expires ? `${expires}T23:59:00` : null,
      });
      setLinks(res.links ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to mint');
    } finally {
      setBusy(false);
    }
  };

  const copyAll = async () => {
    if (!links) return;
    await navigator.clipboard.writeText(links.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mt-2 space-y-2 border-t border-white/5 pt-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="text-[11px] text-gray-500">Codes</span>
          <Input
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="mt-0.5 h-8 w-20 bg-black/30 border-white/10 text-xs"
          />
        </label>
        <label className="block">
          <span className="text-[11px] text-gray-500">Expires (optional)</span>
          <Input
            type="date"
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
            className="mt-0.5 h-8 bg-black/30 border-white/10 text-xs"
          />
        </label>
        <label className="block">
          <span className="text-[11px] text-gray-500">Link language</span>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as 'nl' | 'en')}
            className="mt-0.5 h-8 rounded border border-white/10 bg-black/30 px-2 text-xs text-gray-200"
          >
            <option value="nl">Nederlands</option>
            <option value="en">English</option>
          </select>
        </label>
        <Button onClick={mint} disabled={busy} size="sm" variant="outline" className="h-8 border-white/15 text-xs">
          {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
          Mint
        </Button>
      </div>

      {err && <div className="text-xs text-red-400">{err}</div>}

      {links && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-emerald-400">{links.length} links ready</span>
            <Button onClick={copyAll} size="sm" variant="ghost" className="h-6 px-2 text-[11px]">
              {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
              {copied ? 'Copied' : 'Copy all'}
            </Button>
          </div>
          <textarea
            readOnly
            value={links.join('\n')}
            rows={Math.min(6, links.length)}
            className="w-full rounded border border-white/10 bg-black/40 p-2 font-mono text-[10px] text-gray-400"
          />
          <p className="text-[11px] text-gray-500">
            One link is one person. Copy these now — the codes stay in the database, but this list is not shown again.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Tab ─────────────────────────────────────────────────────────────────────

const PartnersTab: React.FC = () => {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await callPartners({ action: 'list' });
      setPartners(res.partners ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggle = async (p: Partner) => {
    await callPartners({ action: 'setActive', slug: p.slug, isActive: !p.is_active });
    void load();
  };

  return (
    <div className="space-y-4">
      <PartnerForm onSaved={load} />

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-200">Partners</h3>
        <Button onClick={load} size="sm" variant="ghost" className="h-7 px-2 text-xs text-gray-400">
          <RefreshCw className="h-3 w-3 mr-1" /> Refresh
        </Button>
      </div>

      {err && <div className="text-xs text-red-400">{err}</div>}
      {loading && <div className="flex items-center gap-2 text-xs text-gray-500"><Loader2 className="h-3 w-3 animate-spin" /> Loading…</div>}

      {!loading && partners.length === 0 && (
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-6 text-center text-xs text-gray-500">
          No partners yet. Add one above.
        </div>
      )}

      {partners.map((p) => (
        <div key={p.slug} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-semibold text-gray-100">{p.name}</span>
            <span className="font-mono text-[11px] text-gray-500">{p.slug}</span>
            {!p.has_logo && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">no logo</span>}
            {!p.is_active && <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] text-red-300">inactive</span>}
            <button onClick={() => toggle(p)} className="ml-auto text-[11px] text-gray-500 hover:text-gray-300">
              {p.is_active ? 'Deactivate' : 'Activate'}
            </button>
          </div>

          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-gray-400">
            <span>Issued <b className="text-gray-200">{p.codes_issued}</b></span>
            <span>Claimed <b className="text-gray-200">{p.codes_claimed}</b></span>
            <span>Started <b className="text-gray-200">{p.surveys_started}</b></span>
            <span>Reports <b className="text-gray-200">{p.reports_completed}</b></span>
            {p.expired_unused > 0 && <span className="text-amber-400">Expired unused {p.expired_unused}</span>}
          </div>

          <MintRow partner={p} />
        </div>
      ))}
    </div>
  );
};

export default PartnersTab;
