// deno test supabase/functions/_shared/outreach.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { isBotUserAgent } from './outreach.ts';

Deno.test('real browsers are not bots', () => {
  const chrome =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
  const iphone =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const edge =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0';
  for (const ua of [chrome, iphone, edge]) assertEquals(isBotUserAgent(ua), false, ua);
});

Deno.test('link scanners and scripts are bots', () => {
  const bots = [
    'curl/8.4.0',
    'python-requests/2.31',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Microsoft Office Outlook 16.0',
    'Mozilla/5.0 (Windows NT 10.0) SafeLinks',
    'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 HeadlessChrome/120.0',
    'Mozilla/5.0 (compatible; Google-Safety; +http://www.google.com/bot.html)',
    'GoogleImageProxy',
    'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
    'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
    'WhatsApp/2.23.20.0',
    'Mozilla/5.0 (Macintosh) Preview/1.0',
  ];
  for (const ua of bots) assertEquals(isBotUserAgent(ua), true, ua);
});

Deno.test('a missing user-agent counts as a bot', () => {
  assertEquals(isBotUserAgent(''), true);
  assertEquals(isBotUserAgent(null), true);
  assertEquals(isBotUserAgent(undefined), true);
});
