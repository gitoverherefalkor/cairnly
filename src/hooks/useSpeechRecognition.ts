// Reusable hook for Web Speech API voice input
// Used by ChatInput and assessment long_text questions

import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import i18n from '@/i18n';

// Web Speech needs the right locale: a Dutch speaker dictating against en-US
// comes out as English gibberish. Resolved at the moment dictation starts, so
// a mid-session language switch applies to the next recording. Keys follow
// the app's supported languages (de is future-proofing, like the domain
// detector in i18n.ts).
const SPEECH_LOCALES: Record<string, string> = {
  nl: 'nl-NL',
  en: 'en-US',
  de: 'de-DE',
};

function speechLocale(): string {
  const lang = (i18n.language || 'en').split('-')[0].toLowerCase();
  return SPEECH_LOCALES[lang] ?? 'en-US';
}

const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const CLEAN_ENDPOINT = `${SUPABASE_URL}/functions/v1/clean-transcript`;

// Tracks whether the user has EVER successfully started voice input, anywhere
// in the app (chat or survey). Drives the one-time "try it" highlight on mic
// buttons — once someone actually uses voice once, the nudge disappears
// everywhere, permanently (persisted, not per-session).
const VOICE_TRIED_KEY = 'atlas_voice_input_tried';
const VOICE_TRIED_EVENT = 'atlas-voice-input-tried';

function markVoiceInputTried() {
  try {
    localStorage.setItem(VOICE_TRIED_KEY, '1');
  } catch {
    // Storage unavailable (private mode, etc.) — the hint just won't persist
    // across reloads; not worth failing the recording over.
  }
  window.dispatchEvent(new Event(VOICE_TRIED_EVENT));
}

/** True once the user has ever started voice input anywhere. Live-updates
 *  across all mounted mic buttons the instant any one of them is first used. */
export function useHasTriedVoiceInput(): boolean {
  const [tried, setTried] = useState(() => {
    try {
      return localStorage.getItem(VOICE_TRIED_KEY) === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (tried) return;
    const onTried = () => setTried(true);
    window.addEventListener(VOICE_TRIED_EVENT, onTried);
    return () => window.removeEventListener(VOICE_TRIED_EVENT, onTried);
  }, [tried]);
  return tried;
}

// Sends the raw dictated text to the clean-transcript edge function, which adds
// punctuation and paragraph breaks. Returns the tidied text, or null on any
// failure (caller keeps the raw text in that case — nothing is lost).
async function cleanTranscript(text: string): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return null; // function requires a real JWT
    const res = await fetch(CLEAN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return typeof data?.text === 'string' && data.text.trim().length > 0
      ? data.text
      : null;
  } catch {
    return null;
  }
}

interface UseSpeechRecognitionOptions {
  /** Called with accumulated text on each recognition result */
  onTranscript: (text: string) => void;
  /** Existing text to prepend to transcript (e.g. current textarea value) */
  existingText?: string;
  /**
   * When true, the final transcript is sent through the clean-transcript edge
   * function (adds punctuation/paragraphs) once the user stops dictating.
   */
  cleanOnStop?: boolean;
}

export function useSpeechRecognition({
  onTranscript,
  existingText = '',
  cleanOnStop = false,
}: UseSpeechRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  // True between the start click and the engine ACTUALLY capturing audio
  // (recognition.start() connects async; words spoken before onaudiostart are
  // dropped). The UI shows a distinct "starting" state so the user waits for
  // the real recording cue before talking.
  const [isStarting, setIsStarting] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const isListeningRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef('');
  const onTranscriptRef = useRef(onTranscript);
  const cleanOnStopRef = useRef(cleanOnStop);
  const unmountedRef = useRef(false);

  // Keep callback/option refs fresh without re-creating recognition
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);
  useEffect(() => {
    cleanOnStopRef.current = cleanOnStop;
  }, [cleanOnStop]);

  // Tidy up the raw transcript via the edge function. On any failure the raw
  // text already shown in the field is left as-is.
  const runCleanup = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setIsCleaning(true);
    try {
      const cleaned = await cleanTranscript(trimmed);
      if (cleaned && !unmountedRef.current) {
        onTranscriptRef.current(cleaned);
      }
    } finally {
      if (!unmountedRef.current) setIsCleaning(false);
    }
  }, []);

  // One-shot flag: when the caller stops recognition because the text was
  // just SENT, the cleanup pass must not run — its result would repopulate
  // the (already cleared) field with stale text.
  const skipCleanOnceRef = useRef(false);

  const stopListening = useCallback((opts?: { skipClean?: boolean }) => {
    // Stops recognition; the `onend` handler captures the final transcript and
    // triggers cleanup (when enabled), so finalTranscriptRef is NOT cleared here.
    if (opts?.skipClean) skipCleanOnceRef.current = true;
    recognitionRef.current?.stop();
    setIsListening(false);
    setIsStarting(false);
    isListeningRef.current = false;
  }, []);

  const startListening = useCallback(async () => {
    if (!SpeechRecognitionAPI) return;
    if (isListeningRef.current) {
      stopListening();
      return;
    }

    setIsStarting(true);

    // Mic permission. When it was granted before, skip the getUserMedia
    // round-trip entirely — it costs real time on every start, and words
    // spoken during it are lost. getUserMedia stays as the reliable way to
    // trigger the browser prompt on first use (or where the Permissions API
    // doesn't know about microphones, e.g. some Safari versions).
    let alreadyGranted = false;
    try {
      const status = await (navigator.permissions as any)?.query?.({ name: 'microphone' });
      alreadyGranted = status?.state === 'granted';
    } catch {
      // Permissions API unavailable for mic — fall through to getUserMedia.
    }
    if (alreadyGranted) {
      markVoiceInputTried();
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        // Permission granted — this is a genuine attempt, not just a click that
        // got denied. Mark it so the "try it" highlight retires everywhere.
        markVoiceInputTried();
      } catch {
        setIsStarting(false);
        return; // User denied mic access
      }
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = speechLocale();

    // The engine is only really capturing once audio starts flowing — flip
    // the UI to "recording" at that moment, not at the start() call.
    recognition.onaudiostart = () => {
      if (unmountedRef.current) return;
      setIsStarting(false);
      if (isListeningRef.current) setIsListening(true);
    };

    finalTranscriptRef.current = existingText ? existingText + ' ' : '';

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      onTranscriptRef.current(finalTranscriptRef.current + interim);
    };

    recognition.onend = () => {
      // Auto-restart if still listening (recognition can timeout)
      if (isListeningRef.current) {
        try {
          recognition.start();
        } catch {
          // Ignore restart failures
        }
        return;
      }
      // Recognition has fully stopped. Optionally tidy up the transcript.
      const raw = finalTranscriptRef.current;
      finalTranscriptRef.current = '';
      const skipClean = skipCleanOnceRef.current;
      skipCleanOnceRef.current = false;
      if (cleanOnStopRef.current && !skipClean && !unmountedRef.current) {
        void runCleanup(raw);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed' || event.error === 'aborted') {
        setIsListening(false);
        setIsStarting(false);
        isListeningRef.current = false;
      }
    };

    recognitionRef.current = recognition;
    // Intent flag goes on now (drives auto-restart and toggle semantics);
    // the visible "recording" state waits for onaudiostart above.
    isListeningRef.current = true;

    try {
      recognition.start();
    } catch {
      setIsListening(false);
      setIsStarting(false);
      isListeningRef.current = false;
    }
  }, [existingText, stopListening, runCleanup]);

  // Toggle convenience — "starting" counts as active, so a second click
  // while the engine is still connecting cancels instead of double-starting.
  const toggleListening = useCallback(async () => {
    if (isListening || isStarting) {
      stopListening();
    } else {
      await startListening();
    }
  }, [isListening, isStarting, startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      recognitionRef.current?.stop();
      isListeningRef.current = false;
    };
  }, []);

  return {
    isListening,
    isStarting,
    isCleaning,
    isSupported: !!SpeechRecognitionAPI,
    toggleListening,
    stopListening,
  };
}
