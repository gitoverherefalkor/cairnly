// FreeCodesTab — mint one free code for one named person.
//
// For the free access handed out by hand (usually WhatsApp), so no email: the
// code is stored with the recipient's name and the day it was handed out.
// Everything goes through the admin-gated ops-free-codes edge function.

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Copy, Check, RefreshCw } from 'lucide-react';

interface FreeCode {
  id: string;
  code: string;
  issued_to: string;
  issued_on: string | null;
  created_at: string;
  is_active: boolean | null;
  user_id: string | null;
  used_at: string | null;
}

async function callFreeCodes<T>(body: Record<string, unknown>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const r = await fetch(`${url}/functions/v1/ops-free-codes`, {
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

/** Today as YYYY-MM-DD in local time (toISOString would give UTC). */
function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

/** Copy button that flips to a check for a moment. */
function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Button onClick={copy} size="sm" variant="ghost" className="h-6 px-2 text-[11px]">
      {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
      {copied ? 'Copied' : label}
    </Button>
  );
}

const FreeCodesTab: React.FC = () => {
  const [name, setName] = useState('');
  const [issuedOn, setIssuedOn] = useState(today);
  const [lang, setLang] = useState<'nl' | 'en'>('nl');
  const [busy, setBusy] = useState(false);
  const [mintErr, setMintErr] = useState<string | null>(null);
  const [minted, setMinted] = useState<{ name: string; code: string; link: string } | null>(null);

  const [codes, setCodes] = useState<FreeCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await callFreeCodes<{ codes?: FreeCode[] }>({ action: 'list' });
      setCodes(res.codes ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const mint = async () => {
    const who = name.trim();
    if (!who) {
      setMintErr('Enter the name of who this code is for.');
      return;
    }
    setBusy(true);
    setMintErr(null);
    setMinted(null);
    try {
      const res = await callFreeCodes<{ code: string; link: string }>({ action: 'mint', issuedTo: who, issuedOn, lang });
      setMinted({ name: who, code: res.code, link: res.link });
      setName('');
      setIssuedOn(today());
      void load();
    } catch (e) {
      setMintErr(e instanceof Error ? e.message : 'Failed to mint');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (c: FreeCode) => {
    try {
      await callFreeCodes({ action: 'setActive', id: c.id, isActive: c.is_active === false });
      void load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to update');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="text-[11px] text-white/60">Name</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void mint(); }}
            placeholder="Who is it for?"
            className="mt-0.5 h-8 w-56 bg-[#0E2531] border-white/[0.14] text-xs"
          />
        </label>
        <label className="block">
          <span className="text-[11px] text-white/60">Date issued</span>
          <Input
            type="date"
            value={issuedOn}
            onChange={(e) => setIssuedOn(e.target.value)}
            className="mt-0.5 h-8 bg-[#0E2531] border-white/[0.14] text-xs"
          />
        </label>
        <label className="block">
          <span className="text-[11px] text-white/60">Link language</span>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as 'nl' | 'en')}
            className="mt-0.5 h-8 rounded border border-white/[0.08] bg-[#0E2531] px-2 text-xs text-white/[0.88]"
          >
            <option value="nl">Nederlands</option>
            <option value="en">English</option>
          </select>
        </label>
        <Button onClick={mint} disabled={busy} size="sm" variant="outline" className="h-8 border-white/15 text-xs">
          {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
          Mint code
        </Button>
      </div>

      {mintErr && <div className="text-xs text-red-400">{mintErr}</div>}

      {minted && (
        <div className="space-y-1 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-3">
          <div className="text-[11px] text-emerald-400">Code for {minted.name}</div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-white/[0.92]">{minted.code}</span>
            <CopyButton text={minted.code} label="Copy code" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="break-all font-mono text-[11px] text-white/70">{minted.link}</span>
            <CopyButton text={minted.link} label="Copy link" />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/[0.88]">Issued</h3>
        <Button onClick={load} size="sm" variant="ghost" className="h-7 px-2 text-xs text-white/70">
          <RefreshCw className="h-3 w-3 mr-1" /> Refresh
        </Button>
      </div>

      {err && <div className="text-xs text-red-400">{err}</div>}
      {loading && <div className="flex items-center gap-2 text-xs text-white/60"><Loader2 className="h-3 w-3 animate-spin" /> Loading…</div>}

      {!loading && codes.length === 0 && (
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-6 text-center text-xs text-white/60">
          No free codes yet. Mint one above.
        </div>
      )}

      {!loading && codes.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] text-white/60">
              <tr>
                <th className="py-1 pr-3 font-normal">Name</th>
                <th className="py-1 pr-3 font-normal">Issued</th>
                <th className="py-1 pr-3 font-normal">Code</th>
                <th className="py-1 pr-3 font-normal">Status</th>
                <th className="py-1 font-normal" />
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => {
                const used = !!c.user_id;
                const inactive = c.is_active === false;
                return (
                  <tr key={c.id} className="border-t border-white/5 text-white/80">
                    <td className="py-1.5 pr-3 text-white/[0.92]">{c.issued_to}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{fmtDate(c.issued_on)}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap font-mono text-[11px]">
                      {c.code}
                      <CopyButton text={c.code} label="Copy" />
                    </td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">
                      {used ? (
                        <span className="text-emerald-400">Used {c.used_at ? fmtDate(c.used_at) : ''}</span>
                      ) : inactive ? (
                        <span className="text-red-300">Deactivated</span>
                      ) : (
                        <span className="text-white/60">Unused</span>
                      )}
                    </td>
                    <td className="py-1.5 text-right">
                      {!used && (
                        <button onClick={() => toggle(c)} className="text-[11px] text-white/60 hover:text-white/80">
                          {inactive ? 'Activate' : 'Deactivate'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default FreeCodesTab;
