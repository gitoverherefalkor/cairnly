// Reusable hook for Web Speech API voice input
// Used by ChatInput and assessment long_text questions

import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

  const stopListening = useCallback(() => {
    // Stops recognition; the `onend` handler captures the final transcript and
    // triggers cleanup (when enabled), so finalTranscriptRef is NOT cleared here.
    recognitionRef.current?.stop();
    setIsListening(false);
    isListeningRef.current = false;
  }, []);

  const startListening = useCallback(async () => {
    if (!SpeechRecognitionAPI) return;
    if (isListeningRef.current) {
      stopListening();
      return;
    }

    // Request mic permission via getUserMedia (reliably triggers browser prompt)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      // Permission granted — this is a genuine attempt, not just a click that
      // got denied. Mark it so the "try it" highlight retires everywhere.
      markVoiceInputTried();
    } catch {
      return; // User denied mic access
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

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
      if (cleanOnStopRef.current && !unmountedRef.current) {
        void runCleanup(raw);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed' || event.error === 'aborted') {
        setIsListening(false);
        isListeningRef.current = false;
      }
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    isListeningRef.current = true;

    try {
      recognition.start();
    } catch {
      setIsListening(false);
      isListeningRef.current = false;
    }
  }, [existingText, stopListening, runCleanup]);

  // Toggle convenience
  const toggleListening = useCallback(async () => {
    if (isListening) {
      stopListening();
    } else {
      await startListening();
    }
  }, [isListening, startListening, stopListening]);

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
    isCleaning,
    isSupported: !!SpeechRecognitionAPI,
    toggleListening,
    stopListening,
  };
}
