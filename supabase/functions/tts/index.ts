import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, handleCorsPreFlight, errorResponse, checkRateLimit } from "../_shared/cors.ts";

// Voice + delivery instructions per language.
//
// The `instructions` field is not just about pace — on gpt-4o-mini-tts it
// steers pronunciation too. English instructions were pushing Dutch text
// toward English phonetics, so nl gets genuinely Dutch instructions (with an
// explicit accent hint and a note about loanwords, which is where an
// English-trained voice normally slips).
//
// Voices differ per language on purpose: nova is a bright American female
// that carries a heavy accent in Dutch; ash reads Dutch more neutrally.
// Adding a language is one entry here.
const LANG_CONFIG: Record<string, { voice: string; instructions: string }> = {
  en: {
    voice: 'nova',
    instructions:
      'Speak at a brisk, upbeat conversational pace, like an energetic but ' +
      'warm career coach. Clear and natural, never rushed or robotic.',
  },
  nl: {
    voice: 'ash',
    instructions:
      'Spreek vlot en natuurlijk Nederlands met een Nederlandse tongval, in ' +
      'een warm maar energiek tempo, zoals een enthousiaste loopbaancoach. ' +
      'Helder en menselijk, nooit gehaast of robotachtig. Spreek Engelse ' +
      'leenwoorden uit zoals een Nederlander dat doet.',
  },
};
const DEFAULT_LANG = 'en';

// The 13 voices gpt-4o-mini-tts accepts. Only used to validate an explicit
// `voice` override, which lets us A/B a candidate voice straight from the
// browser without redeploying this function. An unknown value is ignored
// rather than rejected, so a bad override degrades to the language default.
const VALID_VOICES = new Set([
  'alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova',
  'onyx', 'sage', 'shimmer', 'verse', 'marin', 'cedar',
]);

// Hard cap on input length — OpenAI's limit is 4096 chars per request and
// long messages cost more anyway. Section reveals are usually under 3000.
const MAX_CHARS = 4000;

serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);

  // Rate limit: 30 requests per minute per IP. Each request maps to one
  // bot-message read; 30/min is generous for a single user but blocks abuse.
  const rateLimited = checkRateLimit(req, 30, corsHeaders);
  if (rateLimited) return rateLimited;

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405, corsHeaders);
  }

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      console.error('OPENAI_API_KEY not configured');
      return errorResponse('TTS not configured', 500, corsHeaders);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body.text !== 'string') {
      return errorResponse('Missing or invalid "text"', 400, corsHeaders);
    }

    const text = body.text.slice(0, MAX_CHARS).trim();
    if (!text) {
      return errorResponse('Empty text', 400, corsHeaders);
    }

    // Normalize 'nl-NL' → 'nl'. An old cached frontend sends no lang at all,
    // which falls through to English — exactly the previous behaviour.
    const rawLang = typeof body.lang === 'string' ? body.lang : DEFAULT_LANG;
    const lang = rawLang.split('-')[0].toLowerCase();
    const config = LANG_CONFIG[lang] ?? LANG_CONFIG[DEFAULT_LANG];

    // Explicit override wins, but only if it names a real voice.
    const override = typeof body.voice === 'string' ? body.voice.toLowerCase() : '';
    const openaiVoice = VALID_VOICES.has(override) ? override : config.voice;

    const openaiResponse = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        voice: openaiVoice,
        input: text,
        instructions: config.instructions,
        response_format: 'mp3',
        speed: 1.0,
      }),
    });

    if (!openaiResponse.ok) {
      const errText = await openaiResponse.text();
      console.error('OpenAI TTS error:', openaiResponse.status, errText);
      return errorResponse('TTS provider error', 502, corsHeaders);
    }

    // Pipe OpenAI's streaming body straight through to the browser. The
    // browser's MediaSource layer can start playback as soon as the first
    // chunk arrives, which makes long section reveals feel instant instead
    // of "wait 5-10 seconds for the whole file to download".
    return new Response(openaiResponse.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('TTS function error:', err);
    return errorResponse('Internal error', 500, corsHeaders);
  }
});
