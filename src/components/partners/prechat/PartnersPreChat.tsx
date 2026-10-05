import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Check, ChevronDown, Pencil, RotateCcw } from 'lucide-react';
import Reveal from '@/components/landing/Reveal';
import { BRAD } from '@/components/landing/Testimonial';
import { formatRichText, RICH_TEXT_CLASSES } from '@/components/landing/intake/richText';
import { trackCtaClick } from '@/lib/analytics';
import { usePartnerChat } from './usePartnerChat';
import PartnerOfferCard from './PartnerOfferCard';

/**
 * The partners pre-chat, straight under the hero on /partners. The demo shows
 * what Cairnly is; this answers "does it belong in my practice?". A starter
 * line seeds an editable first message; sent unedited it gets an instant
 * canned reply, edited or typed it gets a live one. Three or four questions
 * later the pitch lands with an offer card computed on the server.
 *
 * Runs on the intake-chat function with `audience: 'partner'`. Design and
 * decisions: docs/superpowers/specs/2026-10-05-partners-prechat-build-handover.md.
 */

const STARTERS = ['clients-blank', 'clients-ai', 'validated', 'shorter', 'ai-self'] as const;
type Starter = (typeof STARTERS)[number];

const ASSISTANT_BUBBLE: React.CSSProperties = {
  background: '#FDFBF2',
  borderColor: 'rgba(201, 182, 144, 0.6)',
  boxShadow: '0 20px 44px -24px rgba(0,0,0,0.30)',
  color: '#1F2937',
};

const chipBase = 'rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors duration-200 cursor-pointer';
const chipSelected = 'bg-[#D4A024] border-[#D4A024] text-[#122E3B]';
const chipIdle = 'border-[#C9B690] text-[#4B6373] hover:border-[#D4A024] hover:text-[#122E3B]';

/** Brad Gentry's words, placed by the interface for the validated-tests starter only. Never in a locale file, never translated. */
const AdviserQuote: React.FC = () => {
  const { t } = useTranslation('partners');
  const { t: tl } = useTranslation('landing');
  const [photoFailed, setPhotoFailed] = useState(false);
  return (
    <figure
      className="max-w-[92%] rounded-2xl border px-5 py-4"
      style={{ background: 'rgba(212,160,36,0.08)', borderColor: 'rgba(212,160,36,0.35)' }}
    >
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8A6410]">{t('prechat.quote.eyebrow')}</div>
      <blockquote className="mt-2 text-[14px] font-medium leading-[1.65] text-[#122E3B]" lang="en">
        “{BRAD.full[0]}”
      </blockquote>
      <figcaption className="mt-3 flex items-center gap-2.5">
        {!photoFailed && (
          <img
            src={BRAD.photo}
            alt=""
            width={28}
            height={28}
            loading="lazy"
            onError={() => setPhotoFailed(true)}
            className="h-7 w-7 rounded-full object-cover"
          />
        )}
        <span className="text-[13px] font-bold text-[#122E3B]">{BRAD.name}</span>
        <span className="text-[12px] text-[#4B6373]">{tl(`testimonial.${BRAD.roleKey}`)}</span>
      </figcaption>
      {t('prechat.quote.untranslated') && (
        <p className="mt-1.5 text-[11px] text-[#6B7F8B]">{t('prechat.quote.untranslated')}</p>
      )}
    </figure>
  );
};

const PartnersPreChat: React.FC = () => {
  const { t, i18n } = useTranslation('partners');
  const lang = (i18n.language || 'nl').slice(0, 2) === 'en' ? 'en' : 'nl';
  const chat = usePartnerChat(lang);

  const [draft, setDraft] = useState('');
  const [picked, setPicked] = useState<Starter | 'other' | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const seedFor = (s: Starter) => t(`prechat.seeds.${s}`);

  // Index of the pitch in the transcript: opener + one answer per question,
  // each followed by a reply, so it is the reply after the last answer.
  const pitchIndex = chat.stage === 'pitched' ? 2 * chat.totalBeats + 1 : -1;
  const pitched = chat.stage === 'pitched';

  useEffect(() => {
    setShowHistory(false);
  }, [chat.stage]);

  const userCount = useMemo(() => chat.messages.filter((m) => m.role === 'user').length, [chat.messages]);
  const currentBeat = chat.beat ?? Math.min(userCount, chat.totalBeats);

  const pickStarter = (s: Starter | 'other') => {
    if (chat.sending) return;
    if (pitched) return; // the pitch is on screen; a starter no longer restarts it
    if (chat.started) chat.reset();
    setPicked(s);
    setDraft(s === 'other' ? '' : seedFor(s));
    trackCtaClick(`partner-prechat-pill-${s}`);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      const len = inputRef.current?.value.length ?? 0;
      inputRef.current?.setSelectionRange(len, len);
    });
  };

  const submit = () => {
    const text = draft.trim();
    if (!text || chat.sending) return;
    if (chat.sessionId) {
      chat.sendMessage(text);
    } else {
      const intent = picked ?? 'other';
      const seeded = intent !== 'other' && text === seedFor(intent);
      trackCtaClick(`partner-prechat-start-${intent}`);
      chat.start(text, intent, seeded);
    }
    setDraft('');
  };

  const [multiPicked, setMultiPicked] = useState<string[]>([]);
  useEffect(() => setMultiPicked([]), [chat.chips]);
  const tapChip = (option: string) => {
    if (chat.sending) return;
    if (!chat.chips?.multi) {
      chat.sendMessage(option);
      return;
    }
    setMultiPicked((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : prev.length >= (chat.chips?.max ?? 3) ? prev : [...prev, option],
    );
  };

  // What the thread shows. Before the pitch: the latest exchange, older ones
  // behind an expander. After it: the pitch, the card and any follow-ups.
  const beforePitch = pitched ? chat.messages.slice(0, pitchIndex) : chat.messages.slice(0, -2);
  const visibleBefore = showHistory ? beforePitch : [];
  const lead = pitched ? chat.messages.slice(pitchIndex, pitchIndex + 1) : chat.messages.slice(-2);
  const followUps = pitched ? chat.messages.slice(pitchIndex + 1) : [];
  const showChips = chat.sessionId && chat.stage === 'chat' && !chat.sending && !!chat.chips?.options.length;

  const bubble = (m: { role: string; text: string; seeded?: boolean }, key: React.Key) =>
    m.role === 'user' ? (
      <div key={key} className="flex justify-end">
        <div
          className="max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[0.9375rem] leading-relaxed"
          style={m.seeded ? { background: '#D4A024', color: '#122E3B', fontWeight: 500 } : { background: '#27A1A1', color: '#fff' }}
        >
          {m.text}
        </div>
      </div>
    ) : (
      <div key={key} className="flex justify-start">
        <div
          className={`max-w-[92%] rounded-[20px] border px-4 py-3.5 text-[14px] leading-[1.6] ${RICH_TEXT_CLASSES}`}
          style={ASSISTANT_BUBBLE}
          dangerouslySetInnerHTML={formatRichText(m.text)}
        />
      </div>
    );

  return (
    <section id="praktijk-check" className="bg-[#ECE4D2] pt-16 pb-6 md:pt-24 md:pb-10 scroll-mt-20">
      <div className="lp-container">
        <div
          className="relative rounded-[28px] px-5 py-8 md:px-12 md:py-12"
          style={{ background: '#FBF6E8', border: '1px solid #C9B690', boxShadow: '0 32px 60px -28px rgba(18,46,59,0.18)' }}
        >
          <Reveal className="max-w-3xl">
            <div className="lp-eyebrow text-[#1F8282] mb-4">{t('prechat.eyebrow')}</div>
            <h2
              className="font-heading font-bold text-[#122E3B] leading-[1.12]"
              style={{ fontSize: 'clamp(24px, 2.6vw, 34px)', letterSpacing: '-0.012em' }}
            >
              {t('prechat.title')}
            </h2>
            <p className="mt-4 max-w-2xl text-[16px] md:text-[17px] font-medium leading-relaxed text-[#4B6373]">
              {t('prechat.subtitle')}
            </p>
          </Reveal>

          <div className="mt-7 flex flex-wrap gap-2">
            {STARTERS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={pitched}
                onClick={() => pickStarter(s)}
                aria-pressed={picked === s}
                className={`${chipBase} ${picked === s ? chipSelected : chipIdle} disabled:cursor-default disabled:opacity-50`}
              >
                {t(`prechat.pills.${s}`)}
              </button>
            ))}
            <button
              type="button"
              disabled={pitched}
              onClick={() => pickStarter('other')}
              aria-pressed={picked === 'other'}
              className={`${chipBase} ${picked === 'other' ? chipSelected : chipIdle} disabled:cursor-default disabled:opacity-50`}
            >
              {t('prechat.pills.other')}
            </button>
          </div>

          <div className="mt-8 max-w-3xl">
            {chat.sessionId && chat.stage === 'chat' && (
              <p className="mb-3 text-[12px] font-semibold text-[#6B7F8B]">
                {t('prechat.question')} {Math.min(currentBeat, chat.totalBeats)}/{chat.totalBeats}
                {chat.beatLabels[currentBeat - 1] && <span className="text-[#122E3B]"> · {chat.beatLabels[currentBeat - 1]}</span>}
              </p>
            )}

            <div className="space-y-3">
              {!chat.started && (
                <div className="flex justify-start">
                  <div className="max-w-[92%] rounded-[20px] border px-4 py-3.5 text-[14px] leading-[1.6]" style={ASSISTANT_BUBBLE}>
                    {t('prechat.restingInvite')}
                  </div>
                </div>
              )}

              {beforePitch.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowHistory((v) => !v)}
                  className="flex items-center gap-1.5 text-[12px] font-semibold text-[#6B7F8B] transition-colors hover:text-[#122E3B]"
                >
                  <ChevronDown size={13} className={showHistory ? 'rotate-180' : ''} />
                  {showHistory ? t('prechat.collapse') : t('prechat.earlier', { count: beforePitch.length })}
                </button>
              )}

              {visibleBefore.map((m, i) => bubble(m, `h${i}`))}
              {lead.map((m, i) => bubble(m, `l${i}`))}

              {pitched && chat.intent === 'validated' && <AdviserQuote />}
              {pitched && chat.offer && (
                <PartnerOfferCard
                  offer={chat.offer}
                  leadState={chat.leadState}
                  leadChoice={chat.leadChoice}
                  onLead={chat.submitLead}
                />
              )}

              {followUps.map((m, i) => bubble(m, `f${i}`))}

              {chat.sending && (
                <div className="flex justify-start" aria-label={t('prechat.typing')}>
                  <div className="flex items-center gap-1.5 rounded-[20px] border px-5 py-4" style={ASSISTANT_BUBBLE}>
                    {[0, 1, 2].map((d) => (
                      <span
                        key={d}
                        className="h-1.5 w-1.5 animate-bounce rounded-full"
                        style={{ background: '#D4A024', animationDelay: `${d * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {showChips && (
                <div
                  className="w-full max-w-xl overflow-hidden rounded-[16px] border"
                  style={{ background: '#FDFBF2', borderColor: 'rgba(39,161,161,0.35)', boxShadow: '0 20px 44px -24px rgba(0,0,0,0.3)' }}
                >
                  {chat.chips!.options.map((option, idx) => {
                    const selected = multiPicked.includes(option);
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => tapChip(option)}
                        aria-pressed={selected}
                        className="flex w-full items-center gap-2.5 border-b px-3.5 py-2.5 text-left transition-colors hover:bg-atlas-teal/5"
                        style={{ borderColor: 'rgba(201,182,144,0.35)', background: selected ? 'rgba(39,161,161,0.10)' : undefined }}
                      >
                        <span
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                          style={selected ? { background: '#27A1A1', color: '#fff' } : { background: 'rgba(39,161,161,0.12)', color: '#1F8282' }}
                        >
                          {selected ? <Check size={12} strokeWidth={3} /> : idx + 1}
                        </span>
                        <span className="text-[13.5px] leading-snug text-[#1F2937]">{option}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => inputRef.current?.focus()}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-atlas-teal/5"
                  >
                    <Pencil size={13} className="ml-1 shrink-0 text-[#6B7F8B]" />
                    <span className="text-[13px] text-[#6B7F8B]">{t('prechat.typeOwn')}</span>
                  </button>
                  {chat.chips!.multi && multiPicked.length > 0 && (
                    <button
                      type="button"
                      onClick={() => chat.sendMessage(multiPicked.join('; '))}
                      className="w-full py-2 text-center text-[13px] font-bold text-white"
                      style={{ background: '#27A1A1' }}
                    >
                      <ArrowRight size={14} className="inline" />
                    </button>
                  )}
                </div>
              )}

              {chat.error && <p className="px-1 text-[13px] font-medium text-[#B4442F]">{t('prechat.error')}</p>}
            </div>

            <form
              className="relative mt-4 max-w-xl"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <input
                ref={inputRef}
                type="text"
                value={draft}
                maxLength={600}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={
                  pitched ? t('prechat.followUp') : chat.started ? t('prechat.inputPlaceholder') : t('prechat.restingPlaceholder')
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 pr-14 text-[0.9375rem] leading-normal text-[#1F2937] shadow-md outline-none transition-colors focus:border-atlas-teal focus:ring-2 focus:ring-atlas-teal/10"
              />
              <button
                type="submit"
                disabled={chat.sending || !draft.trim()}
                aria-label={t('prechat.send')}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md bg-atlas-teal text-white transition-opacity disabled:opacity-40"
              >
                <ArrowRight size={16} strokeWidth={2.4} />
              </button>
            </form>

            {chat.started && !chat.sending && (
              <button
                type="button"
                onClick={() => {
                  chat.reset();
                  setPicked(null);
                  setDraft('');
                }}
                className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-[#6B7F8B] underline underline-offset-2 hover:text-[#122E3B]"
              >
                <RotateCcw size={12} />
                {t('prechat.restart')}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default PartnersPreChat;
