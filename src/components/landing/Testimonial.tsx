import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Quote, Linkedin } from 'lucide-react';
import Reveal from './Reveal';
import { trackCtaClick } from '@/lib/analytics';

/**
 * Two voices, side by side: the person who did the assessment and the
 * professional who judges such tools for a living. Peer proof and expert proof
 * answer different doubts, so both pages carry both, in the order that suits
 * the reader.
 *
 * Every quote here lives in this file as a constant and NOT in public/locales,
 * on purpose. These are real people's words: a translator, or the language
 * contract, would cheerfully produce a Dutch sentence neither of them ever
 * said. Only the labels around a quote are translated. If the wording here
 * changes, it changes because they said so.
 *
 * Permission:
 * - Brad Gentry, by mail 16 September 2026: quote, name, photo, LinkedIn.
 * - Valentina Constenla Kasat, by LinkedIn message 20 August 2026: "feel free
 *   to use my LI picture and to make a quote from the message I sent you", and
 *   explicitly to use sentences from her earlier messages. She wrote a summary
 *   quote herself; what stands below is that text, trimmed, never reworded.
 *   She is shown as "Valentina C.": permission covered her full name, but she
 *   is a private individual talking about her own career, and the link proves
 *   she is real for anyone who wants to check.
 *
 * Two edits against the originals, marked here so nobody has to wonder:
 * - Brad's "The A.I. Aspects" is lowercased to "aspects". A stray capital
 *   reads as our typo on our own page.
 * - Valentina's quote opens "To summarize… thank you.", which is addressed to
 *   Sjoerd rather than to a reader, so the excerpt starts at the next
 *   sentence. Every passage kept is verbatim and free of second-person
 *   address, so nothing had to be reworded to make it read on a page.
 */

interface Person {
  name: string;
  /** i18n key under `testimonial` for the line under the name. */
  roleKey: string;
  /** i18n key for the label above the quote. */
  eyebrowKey: string;
  /** Public path. A missing file falls back to the initials, no code change. */
  photo: string;
  /** Only when a PUBLIC profile URL exists: a LinkedIn member URN is useless to a visitor. */
  linkedIn?: string;
  /** The whole review, for a reader who wants the detail. */
  full: string[];
  /** The passage that carries it, for a page that cannot spare the room. */
  short: string[];
}

const BRAD: Person = {
  name: 'Brad Gentry',
  roleKey: 'roleCoach',
  eyebrowKey: 'eyebrowCoach',
  photo: '/images/live/brad-gentry-192.jpeg',
  linkedIn: 'https://www.linkedin.com/in/brad-gentry-1227856/',
  full: [
    'This is by far the best career tool I have come across in the 25 years I have been advising people on their careers. Career Anchors was always my go to process, but this has taken career planning to another level.',
    "Comprehensive, a proper deep dive into gaining clarity around one's future career choices.",
    'Yet this tool has an almost "caring" feel to it, as though the author really wants to help people. The A.I. aspects have been thoughtfully woven into the format.',
  ],
  // The consumer page drops the Career Anchors sentence: outside the
  // profession that name carries nothing.
  short: [
    'This is by far the best career tool I have come across in the 25 years I have been advising people on their careers.',
    'Yet this tool has an almost "caring" feel to it, as though the author really wants to help people.',
  ],
};

const VALENTINA: Person = {
  // Her first name and an initial, at Sjoerd's request. The link goes to the
  // full profile, so anyone who wants to check she is real still can.
  name: 'Valentina C.',
  roleKey: 'roleCandidate',
  eyebrowKey: 'eyebrowCandidate',
  photo: '/images/live/valentina-c-192.jpeg',
  linkedIn: 'https://www.linkedin.com/in/valentina-constenla-kasat/',
  full: [
    'The results were very meaningful to me and allowed me to understand myself in a new, valuable way. Nobody teaches us to know ourselves.',
    'Before using Cairnly, I felt like I was made of pieces of different puzzles, like an odd Frankenstein. After completing the assessment I can see the image these pieces form, and it is not odd or weird, it actually makes a lot of sense and I trust it will help me aim for what truly suits me.',
  ],
  short: [
    'Before using Cairnly, I felt like I was made of pieces of different puzzles, like an odd Frankenstein. After completing the assessment I can see the image these pieces form, and I trust it will help me aim for what truly suits me.',
  ],
};

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

const Card: React.FC<{ person: Person; variant: 'short' | 'full' }> = ({ person, variant }) => {
  const { t } = useTranslation('landing');
  const [photoFailed, setPhotoFailed] = useState(false);
  const paragraphs = variant === 'full' ? person.full : person.short;

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-[#122E3B]/10 bg-[#FAF5E8] px-7 py-8 md:px-9 md:py-10 shadow-[0_1px_2px_rgba(18,46,59,0.04),0_12px_32px_-12px_rgba(18,46,59,0.12)]">
      {/* Decoration only, so it steps aside on a phone rather than sitting on
          top of the label. The eyebrow keeps its right margin regardless. */}
      <Quote
        size={64}
        strokeWidth={1.25}
        aria-hidden="true"
        className="pointer-events-none absolute top-6 right-6 hidden text-[#D4A024]/70 fill-[#D4A024]/25 sm:block"
      />

      <figure className="relative flex h-full flex-col">
        <div className="lp-eyebrow text-[#1F8282] mb-5 sm:pr-20">{t(`testimonial.${person.eyebrowKey}`)}</div>

        {/* Deliberately NOT font-heading: Poppins made the quote read as a
            heading, out of step with every other paragraph on the page. This
            is prose, so it is Inter at the weight the rest of the body uses. */}
        <blockquote
          className="text-[#122E3B] font-medium leading-relaxed space-y-4"
          style={{ fontSize: 'clamp(16px, 1.25vw, 19px)' }}
        >
          {paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </blockquote>

        {/* mt-auto pins both cards' attributions to the same baseline, however
            unevenly the quotes above them run. */}
        <figcaption className="mt-auto flex items-center gap-3.5 border-t border-[#122E3B]/10 pt-7">
          {photoFailed ? (
            <span
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#D4A024]/18 font-heading text-[14px] font-bold text-[#8A6414]"
            >
              {initials(person.name)}
            </span>
          ) : (
            <img
              src={person.photo}
              alt={person.name}
              width={44}
              height={44}
              loading="lazy"
              onError={() => setPhotoFailed(true)}
              className="h-11 w-11 shrink-0 rounded-full object-cover"
            />
          )}

          <div className="min-w-0">
            <div className="font-heading font-bold text-[#122E3B] leading-tight">{person.name}</div>
            <div className="text-[13px] text-[#122E3B]/65">{t(`testimonial.${person.roleKey}`)}</div>
          </div>

          {person.linkedIn && (
            /* Below sm the label is display:none, which hides it from screen
               readers as well and would leave the link with no name. */
            <a
              href={person.linkedIn}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${person.name} ${t('testimonial.linkedin')}`}
              onClick={() => trackCtaClick('testimonial-linkedin')}
              className="ml-auto inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-[#122E3B]/55 transition-colors hover:text-[#1F8282]"
            >
              <Linkedin size={16} strokeWidth={2} />
              <span className="hidden sm:inline">{t('testimonial.linkedin')}</span>
            </a>
          )}
        </figcaption>
      </figure>
    </div>
  );
};

/**
 * `audience` decides who speaks first, not who speaks. A career professional
 * reading the partner page wants to hear from a peer; someone weighing the
 * assessment for themselves wants to hear from someone who took it.
 */
const Testimonial: React.FC<{ variant?: 'short' | 'full'; audience?: 'consumer' | 'partner' }> = ({
  variant = 'short',
  audience = 'consumer',
}) => {
  const people = audience === 'partner' ? [BRAD, VALENTINA] : [VALENTINA, BRAD];

  return (
    <section className="bg-[#ECE4D2] py-20 md:py-28">
      <div className="lp-container">
        <Reveal className="mx-auto grid max-w-5xl items-stretch gap-6 lg:grid-cols-2">
          {people.map((person) => (
            <Card key={person.name} person={person} variant={variant} />
          ))}
        </Reveal>
      </div>
    </section>
  );
};

export default Testimonial;
