import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Quote, Linkedin } from 'lucide-react';
import Reveal from './Reveal';
import { trackCtaClick } from '@/lib/analytics';

/**
 * Brad Gentry on Cairnly. Sent by mail on 16 September 2026 and used with his
 * permission, photo included.
 *
 * The quote lives in this file as a constant and NOT in public/locales, on
 * purpose. These are a real person's words: a translator, or the language
 * contract, would cheerfully produce a Dutch sentence he never said. Only the
 * labels around the quote are translated. If the wording here ever needs to
 * change, it changes because Brad said so.
 *
 * The one edit against his mail is "The A.I. Aspects" -> "aspects". A stray
 * capital reads as our typo on our own page; the meaning is untouched.
 */

const LINKEDIN_URL = 'https://www.linkedin.com/in/brad-gentry-1227856/';
const NAME = 'Brad Gentry';
/** Drop a square headshot here and it appears; until then the initials show. */
const PHOTO_URL = '/testimonials/brad-gentry.jpg';

/** The whole review, for readers who are career professionals themselves. */
const QUOTE_FULL = [
  'This is by far the best career tool I have come across in the 25 years I have been advising people on their careers. Career Anchors was always my go to process, but this has taken career planning to another level.',
  "Comprehensive, a proper deep dive into gaining clarity around one's future career choices.",
  'Yet this tool has an almost "caring" feel to it, as though the author really wants to help people. The A.I. aspects have been thoughtfully woven into the format.',
];

/**
 * Two sentences from the same review for the consumer page, where "Career
 * Anchors" is jargon nobody outside the profession knows. Kept as two
 * paragraphs rather than spliced into one, so it reads as what it is: two
 * passages from a longer note.
 */
const QUOTE_SHORT = [
  'This is by far the best career tool I have come across in the 25 years I have been advising people on their careers.',
  'Yet this tool has an almost "caring" feel to it, as though the author really wants to help people.',
];

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

const Testimonial: React.FC<{ variant?: 'short' | 'full' }> = ({ variant = 'short' }) => {
  const { t } = useTranslation('landing');
  const [photoFailed, setPhotoFailed] = useState(false);
  const paragraphs = variant === 'full' ? QUOTE_FULL : QUOTE_SHORT;

  return (
    <section className="bg-[#ECE4D2] pb-20 md:pb-28">
      <div className="lp-container">
        <Reveal className="mx-auto max-w-3xl">
          <div className="relative overflow-hidden rounded-2xl border border-[#122E3B]/10 bg-[#FAF5E8] px-7 py-9 md:px-12 md:py-12 shadow-[0_1px_2px_rgba(18,46,59,0.04),0_12px_32px_-12px_rgba(18,46,59,0.12)]">
            {/* Oversized quote mark, decorative only. */}
            <Quote
              size={88}
              strokeWidth={1.25}
              aria-hidden="true"
              className="pointer-events-none absolute top-6 right-6 text-[#D4A024]/15"
            />

            <div className="relative">
              <div className="lp-eyebrow text-[#1F8282] mb-6">{t('testimonial.eyebrow')}</div>

              <figure>
                <blockquote
                  cite={LINKEDIN_URL}
                  className="font-heading text-[#122E3B] leading-[1.45] space-y-5"
                  style={{ fontSize: 'clamp(19px, 1.9vw, 25px)', letterSpacing: '-0.008em' }}
                >
                  {paragraphs.map((p) => (
                    <p key={p}>{p}</p>
                  ))}
                </blockquote>

                <figcaption className="mt-9 flex items-center gap-4 border-t border-[#122E3B]/10 pt-7">
                  {photoFailed ? (
                    <span
                      aria-hidden="true"
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#D4A024]/18 font-heading text-[15px] font-bold text-[#8A6414]"
                    >
                      {initials(NAME)}
                    </span>
                  ) : (
                    <img
                      src={PHOTO_URL}
                      alt={NAME}
                      width={48}
                      height={48}
                      loading="lazy"
                      onError={() => setPhotoFailed(true)}
                      className="h-12 w-12 shrink-0 rounded-full object-cover"
                    />
                  )}

                  <div className="min-w-0">
                    <div className="font-heading font-bold text-[#122E3B]">{NAME}</div>
                    <div className="text-sm text-[#122E3B]/65">{t('testimonial.role')}</div>
                  </div>

                  {/* Below sm the label is display:none, which hides it from screen
                      readers as well and would leave the link with no name. */}
                  <a
                    href={LINKEDIN_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${NAME} ${t('testimonial.linkedin')}`}
                    onClick={() => trackCtaClick('testimonial-linkedin')}
                    className="ml-auto inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-[#122E3B]/55 transition-colors hover:text-[#1F8282]"
                  >
                    <Linkedin size={16} strokeWidth={2} />
                    <span className="hidden sm:inline">{t('testimonial.linkedin')}</span>
                  </a>
                </figcaption>
              </figure>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

export default Testimonial;
