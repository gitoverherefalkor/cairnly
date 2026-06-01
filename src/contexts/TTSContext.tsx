import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY_READ_ALL = 'cairnly:tts:read-all';
const STORAGE_KEY_RATE = 'cairnly:tts:rate';

// User-selectable playback speeds. Backend audio is always rendered at 1.0;
// these only change how fast the browser plays it back. Pitch is preserved by
// the browser where supported, so the voice stays natural.
export const PLAYBACK_RATES = [1, 1.1, 1.2] as const;
const DEFAULT_RATE = 1;

// Resolve the TTS edge function URL from the same env var the supabase client
// uses. Prevents drift between staging/prod.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const TTS_ENDPOINT = `${SUPABASE_URL}/functions/v1/tts`;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

interface TTSContextValue {
  // Always true now — we use OpenAI TTS via the edge function instead of
  // browser speechSynthesis. Kept on the type so consumers don't break.
  isSupported: boolean;
  // True while audio is loading or actively playing for `speakingId`.
  isSpeaking: boolean;
  speakingId: string | null;
  // True while we're fetching the MP3 from the edge function (before
  // playback starts). Lets the button show a spinner state.
  isLoading: boolean;
  loadingId: string | null;
  readAll: boolean;
  setReadAll: (v: boolean) => void;
  // Browser-side playback speed (1, 1.1, 1.2). Does not change the backend
  // audio — only how fast it plays.
  playbackRate: number;
  setPlaybackRate: (v: number) => void;
  speak: (text: string, id: string) => void;
  stop: () => void;
}

const TTSContext = createContext<TTSContextValue | null>(null);

// Strip markdown / HTML so the synthesizer reads natural prose.
function stripForSpeech(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^\s*---+\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const TTSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [readAll, setReadAllState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY_READ_ALL) === 'true';
  });
  const [playbackRate, setPlaybackRateState] = useState<number>(() => {
    if (typeof window === 'undefined') return DEFAULT_RATE;
    const stored = Number(localStorage.getItem(STORAGE_KEY_RATE));
    return PLAYBACK_RATES.includes(stored as (typeof PLAYBACK_RATES)[number])
      ? stored
      : DEFAULT_RATE;
  });

  // Keep the latest rate in a ref so `speak` (memoized) can read it without
  // re-creating the callback on every rate change.
  const rateRef = useRef(playbackRate);
  rateRef.current = playbackRate;

  // Single shared audio element + abort controller. We re-use them so the
  // user can spam play/stop on different messages without leaking handles.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    cleanupAudio();
    setIsSpeaking(false);
    setSpeakingId(null);
    setIsLoading(false);
    setLoadingId(null);
  }, [cleanupAudio]);

  // Stop any playback on unmount (e.g. user navigates away).
  useEffect(() => {
    return () => stop();
  }, [stop]);

  const speak = useCallback(
    async (text: string, id: string) => {
      const cleaned = stripForSpeech(text);
      if (!cleaned) return;

      // Cancel any in-flight request + audio before starting fresh.
      stop();

      const controller = new AbortController();
      abortRef.current = controller;
      setIsLoading(true);
      setLoadingId(id);

      try {
        // Get the auth token so the request goes through Supabase auth.
        // Anon key fallback is fine — the function itself is public CORS.
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token ?? SUPABASE_ANON_KEY;

        const response = await fetch(TTS_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ text: cleaned, voice: 'female' }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          console.error('TTS request failed:', response.status, await response.text());
          setIsLoading(false);
          setLoadingId(null);
          return;
        }

        const audio = new Audio();
        audio.playbackRate = rateRef.current;
        audioRef.current = audio;

        audio.onplay = () => {
          setIsLoading(false);
          setLoadingId(null);
          setIsSpeaking(true);
          setSpeakingId(id);
        };
        audio.onended = () => {
          cleanupAudio();
          setIsSpeaking(false);
          setSpeakingId((current) => (current === id ? null : current));
        };
        audio.onerror = () => {
          cleanupAudio();
          setIsLoading(false);
          setLoadingId(null);
          setIsSpeaking(false);
          setSpeakingId((current) => (current === id ? null : current));
        };

        // Try MediaSource streaming first — playback starts as soon as the
        // first chunk arrives (~600-800ms) instead of waiting for the full
        // MP3 (~5-10s for long section reveals). Falls back to a full-blob
        // download if MSE isn't available or doesn't support audio/mpeg.
        const canStream =
          typeof MediaSource !== 'undefined' &&
          MediaSource.isTypeSupported('audio/mpeg');

        if (canStream) {
          const mediaSource = new MediaSource();
          const url = URL.createObjectURL(mediaSource);
          audioUrlRef.current = url;
          audio.src = url;

          mediaSource.addEventListener(
            'sourceopen',
            () => {
              const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');
              const reader = response.body!.getReader();
              const queue: Uint8Array[] = [];
              let streamDone = false;

              const flush = () => {
                if (sourceBuffer.updating) return;
                if (queue.length > 0) {
                  sourceBuffer.appendBuffer(queue.shift()!);
                  return;
                }
                if (streamDone && mediaSource.readyState === 'open') {
                  mediaSource.endOfStream();
                }
              };

              sourceBuffer.addEventListener('updateend', flush);

              const pump = async () => {
                try {
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                      streamDone = true;
                      flush();
                      break;
                    }
                    queue.push(value);
                    flush();
                  }
                } catch (err) {
                  if ((err as Error)?.name !== 'AbortError') {
                    console.error('TTS stream pump error:', err);
                  }
                }
              };

              pump();
            },
            { once: true }
          );
        } else {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          audioUrlRef.current = url;
          audio.src = url;
        }

        await audio.play();
      } catch (err) {
        // AbortError is expected when stop() is called mid-fetch.
        if ((err as Error)?.name !== 'AbortError') {
          console.error('TTS speak error:', err);
        }
        setIsLoading(false);
        setLoadingId(null);
      }
    },
    [stop, cleanupAudio]
  );

  const setReadAll = useCallback((v: boolean) => {
    setReadAllState(v);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_READ_ALL, String(v));
    }
  }, []);

  const setPlaybackRate = useCallback((v: number) => {
    setPlaybackRateState(v);
    // Apply immediately to anything currently playing.
    if (audioRef.current) {
      audioRef.current.playbackRate = v;
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_RATE, String(v));
    }
  }, []);

  const value: TTSContextValue = {
    isSupported: true,
    isSpeaking,
    speakingId,
    isLoading,
    loadingId,
    readAll,
    setReadAll,
    playbackRate,
    setPlaybackRate,
    speak,
    stop,
  };

  return <TTSContext.Provider value={value}>{children}</TTSContext.Provider>;
};

export function useTTS(): TTSContextValue {
  const ctx = useContext(TTSContext);
  if (!ctx) {
    return {
      isSupported: false,
      isSpeaking: false,
      speakingId: null,
      isLoading: false,
      loadingId: null,
      readAll: false,
      setReadAll: () => {},
      playbackRate: DEFAULT_RATE,
      setPlaybackRate: () => {},
      speak: () => {},
      stop: () => {},
    };
  }
  return ctx;
}
