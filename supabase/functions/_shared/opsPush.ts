// Web Push to Sjoerd's Chrome, for the outreach cockpit.
//
// One-man operation, one browser: every subscription in ops_push_subscriptions
// belongs to an admin and gets every ping. The rules that keep this from
// becoming noise live here:
//   - every ping has a (kind, key, day) row in ops_push_log, inserted FIRST;
//     a second call for the same thing that day finds the row and stays quiet;
//   - replies arriving between 20:00 and 08:00 are not pushed at night; the
//     08:30 digest already lists them;
//   - a push that fails never fails the caller. It is logged and forgotten.
//
// Keys: VAPID_KEYS_JSON is the exportVapidKeys() output (JWK, private part
// included) and lives only in Supabase secrets. The browser's public key is
// derived from it (vapidPublicKey), so no second copy exists anywhere.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import * as webpush from 'jsr:@negrel/webpush@0.5.0';

export interface PushPayload {
  title: string;
  body: string;
  /** Where a click on the notification goes. */
  url: string;
  /** Same tag replaces the previous notification instead of stacking. */
  tag: string;
}

const CONTACT = 'mailto:sjoerd@cairnly.io';

let serverPromise: Promise<webpush.ApplicationServer> | null = null;

async function appServer(): Promise<webpush.ApplicationServer> {
  if (!serverPromise) {
    serverPromise = (async () => {
      const raw = Deno.env.get('VAPID_KEYS_JSON');
      if (!raw) throw new Error('VAPID_KEYS_JSON not configured');
      const vapidKeys = await webpush.importVapidKeys(JSON.parse(raw), { extractable: false });
      return await webpush.ApplicationServer.new({ contactInformation: CONTACT, vapidKeys });
    })();
    serverPromise.catch(() => {
      serverPromise = null;
    });
  }
  return await serverPromise;
}

/** The base64url public key the browser subscribes with. */
export async function vapidPublicKey(): Promise<string> {
  const raw = Deno.env.get('VAPID_KEYS_JSON');
  if (!raw) throw new Error('VAPID_KEYS_JSON not configured');
  const keys = await webpush.importVapidKeys(JSON.parse(raw), { extractable: true });
  return await webpush.exportApplicationServerKey(keys);
}

function amsterdamClock(now: Date): { day: string; minutes: number } {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? '';
  return { day: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

/** Send to every subscription. Returns how many took it. Never throws. */
export async function sendToAll(db: SupabaseClient, payload: PushPayload): Promise<number> {
  try {
    const server = await appServer();
    const { data: subs, error } = await db.from('ops_push_subscriptions').select('id, endpoint, p256dh, auth, failed_count');
    if (error) throw error;
    let delivered = 0;
    for (const s of subs ?? []) {
      try {
        const subscriber = server.subscribe({
          endpoint: s.endpoint as string,
          keys: { p256dh: s.p256dh as string, auth: s.auth as string },
        });
        await subscriber.pushTextMessage(JSON.stringify(payload), { urgency: webpush.Urgency.High, ttl: 6 * 3600, topic: payload.tag.slice(0, 32) });
        delivered++;
        await db.from('ops_push_subscriptions').update({ last_ok_at: new Date().toISOString(), failed_count: 0 }).eq('id', s.id);
      } catch (e) {
        if (e instanceof webpush.PushMessageError && e.isGone()) {
          await db.from('ops_push_subscriptions').delete().eq('id', s.id);
        } else {
          console.error('[opsPush] delivery failed', s.id, e);
          await db.from('ops_push_subscriptions').update({ failed_count: Number(s.failed_count ?? 0) + 1 }).eq('id', s.id);
        }
      }
    }
    return delivered;
  } catch (e) {
    console.error('[opsPush] push unavailable', e);
    return 0;
  }
}

/**
 * Ping once per (kind, key, Amsterdam day). With `quietHours`, nothing is sent
 * between 20:00 and 08:00 (the log row is not written either, so the digest
 * or a later event can still carry it). Never throws.
 */
export async function notifyPush(
  db: SupabaseClient,
  kind: string,
  key: string,
  payload: PushPayload,
  opts: { quietHours?: boolean; now?: Date } = {},
): Promise<boolean> {
  try {
    const clock = amsterdamClock(opts.now ?? new Date());
    if (opts.quietHours && (clock.minutes < 8 * 60 || clock.minutes >= 20 * 60)) return false;
    const { error } = await db.from('ops_push_log').insert({ kind, key, day: clock.day });
    if (error) {
      if (error.code === '23505') return false; // already pinged about this today
      throw error;
    }
    return (await sendToAll(db, payload)) > 0;
  } catch (e) {
    console.error('[opsPush] notify failed', kind, key, e);
    return false;
  }
}

/** Where every outreach ping points. */
export const OPS_OUTREACH_URL = 'https://cairnly.io/ops';
