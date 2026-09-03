import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { chooseFixture, type DemoPersonaId } from '@/demo/loadFixture';
import type { DemoFixture } from '@/demo/types';
import { HERO_REPLAY, excerptText } from '@/demo/heroReplay';

interface Bubble {
  id: string;
  sender: 'user' | 'bot';
  text: string;
}

// One load per persona + UI language for the whole page life: swapping the
// toggle back and forth must be instant after the first time.
const fixtureCache = new Map<string, Promise<DemoFixture>>();
function loadReplayFixture(persona: DemoPersonaId, lang: string): Promise<DemoFixture> {
  const key = `${persona}:${lang}`;
  let pending = fixtureCache.get(key);
  if (!pending) {
    pending = chooseFixture(lang, persona).load(lang);
    fixtureCache.set(key, pending);
  }
  return pending;
}

const TYPING_BOT_MS = 900;
const TYPING_USER_MS = 600;
const READ_PAUSE_MS = 1200;
const FIRST_DELAY_MS = 400;
const HOLD_MS = 3000;

// The first sections of the report, as the real sidebar names them.
const SIDEBAR_KEYS = [
  'sections.personalityTeam.title',
  'sections.strengths.title',
  'sections.growth.title',
  'sections.values.title',
  'sections.firstCareer',
];
const SIDEBAR_CURRENT = 2;

interface MiniReplayProps {
  persona: DemoPersonaId;
  /** False while the window sits behind another: the timeline pauses. */
  playing?: boolean;
}

/**
 * A few real turns of the persona's coaching session, typed out bubble by
 * bubble inside the hero's faux browser. Text comes from the same fixture
 * (and translation sidecar) the /demo replay uses, so it follows the UI
 * language and can never drift from the demo. Loops with a hold at the end;
 * prefers-reduced-motion shows the whole excerpt at once.
 */
const MiniReplay: React.FC<MiniReplayProps> = ({ persona, playing = true }) => {
  const { i18n } = useTranslation();
  const { t: tReport } = useTranslation('report');
  const lang = (i18n.language || 'en').slice(0, 2).toLowerCase();
  const [bubbles, setBubbles] = useState<Bubble[] | null>(null);
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState(false);
  const reduceMotion = useMemo(
    () => typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    setBubbles(null);
    setShown(0);
    setTyping(false);
    loadReplayFixture(persona, lang)
      .then((fixture) => {
        if (cancelled) return;
        const byId = new Map(fixture.messages.map((m) => [m.id, m]));
        setBubbles(
          HERO_REPLAY[persona].flatMap((id) => {
            const m = byId.get(id);
            return m ? [{ id, sender: m.sender, text: excerptText(m.content) }] : [];
          }),
        );
      })
      .catch(() => {
        if (!cancelled) setBubbles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [persona, lang]);

  // The timeline: pause, typing indicator, bubble; hold at the end; loop.
  useEffect(() => {
    if (!bubbles || bubbles.length === 0) return;
    if (reduceMotion) {
      setShown(bubbles.length);
      setTyping(false);
      return;
    }
    if (!playing) return;
    let timer: number;
    if (shown >= bubbles.length) {
      timer = window.setTimeout(() => setShown(0), HOLD_MS);
      return () => window.clearTimeout(timer);
    }
    const next = bubbles[shown];
    const typingMs = next.sender === 'bot' ? TYPING_BOT_MS : TYPING_USER_MS;
    timer = window.setTimeout(() => {
      setTyping(true);
      timer = window.setTimeout(() => {
        setTyping(false);
        setShown((s) => s + 1);
      }, typingMs);
    }, shown === 0 ? FIRST_DELAY_MS : READ_PAUSE_MS);
    return () => window.clearTimeout(timer);
  }, [bubbles, shown, playing, reduceMotion]);

  const visible = bubbles?.slice(0, shown) ?? [];
  const nextSender: Bubble['sender'] | null =
    bubbles === null ? 'bot' : shown < bubbles.length ? bubbles[shown].sender : null;
  const showTyping = bubbles === null || (typing && nextSender !== null);

  return (
    <div className="absolute inset-0 flex text-[12px] md:text-[13px]">
      {/* Report sidebar, as decoration: the real one lists the same sections. */}
      <aside
        aria-hidden="true"
        className="hidden sm:flex w-[31%] max-w-[180px] shrink-0 flex-col gap-2 bg-[#0F1F28] border-r border-white/5 px-3 py-3"
      >
        {SIDEBAR_KEYS.map((key, i) => {
          const done = i < SIDEBAR_CURRENT;
          const current = i === SIDEBAR_CURRENT;
          return (
            <div
              key={key}
              className={`flex items-center gap-2 text-[11px] font-semibold leading-tight ${
                current ? 'text-white' : done ? 'text-white/55' : 'text-white/30'
              }`}
            >
              <span
                className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full ${
                  current ? 'bg-[#D4A024]' : done ? 'bg-[#27A1A1]/70' : 'border border-white/20'
                }`}
              >
                {done && <Check size={9} strokeWidth={3} className="text-white" />}
              </span>
              <span className="truncate">{tReport(key)}</span>
            </div>
          );
        })}
      </aside>

      {/* The conversation, newest turn always in view. */}
      <div
        className="flex-1 min-w-0 flex flex-col justify-end gap-2 px-3 py-3 overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #15262F 0%, #1B3440 100%)' }}
        aria-live="off"
      >
        {visible.map((b) => (
          <div
            key={b.id}
            className={`lp-replay-in max-w-[88%] rounded-2xl px-3 py-2 leading-snug font-medium ${
              b.sender === 'bot'
                ? 'self-start rounded-bl-md bg-[#FDFBF2] text-[#122E3B]'
                : 'self-end rounded-br-md bg-[#27A1A1] text-white'
            }`}
          >
            {b.text}
          </div>
        ))}
        {showTyping && (
          <div
            className={`lp-replay-in inline-flex items-center gap-1 rounded-2xl px-3 py-2.5 ${
              nextSender === 'bot' ? 'self-start rounded-bl-md bg-[#FDFBF2]' : 'self-end rounded-br-md bg-[#27A1A1]'
            }`}
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full animate-bounce ${nextSender === 'bot' ? 'bg-[#4B6373]' : 'bg-white'}`}
                style={{ animationDelay: `${i * 140}ms` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MiniReplay;
