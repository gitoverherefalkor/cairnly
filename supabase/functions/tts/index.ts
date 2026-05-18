import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, handleCorsPreFlight, errorResponse, checkRateLimit } from "../_shared/cors.ts";

// Voices supported by OpenAI gpt-4o-mini-tts. We expose two friendly names
// to the frontend (female / male) and map them here so the API surface
// stays simple. nova/ash are the brighter, more energetic options.
const VOICE_MAP: Record<string, string> = {
  female: 'nova',   // bright, energetic (American)
  male: 'verse',    // expressive, dynamic male — faster natural cadence
};

// Steers delivery on gpt-4o-mini-tts. Produces genuinely faster speech
// rather than time-stretched audio, so it stays natural at speed 1.0.
const DELIVERY_INSTRUCTIONS =
  'Speak at a brisk, upbeat conversational pace, like an energetic but ' +
  'warm career coach. Clear and natural, never rushed or robotic.';

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

    const requestedVoice = typeof body.voice === 'string' ? body.voice : 'female';
    const openaiVoice = VOICE_MAP[requestedVoice] ?? VOICE_MAP.female;

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
        instructions: DELIVERY_INSTRUCTIONS,
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
