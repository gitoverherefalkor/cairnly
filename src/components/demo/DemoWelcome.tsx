import React from 'react';
import { WelcomeCard } from '@/components/chat/WelcomeCard';
import { QuickReplies } from '@/components/chat/QuickReplies';

interface DemoWelcomeProps {
  // "Ik ben er klaar voor!" in the replay jumps to the first turn of the
  // conversation instead of starting a session.
  onReady: () => void;
  caption: string;
  pillsCaption: string;
}

const noop = () => {};

/**
 * The opening of every real session, shown above the transcript: the
 * welcome card the persona clicked through, and (demo-only) a static
 * illustration of the four quick-reply pills that sit under each coach
 * message. Both are the real components; the pills are just not clickable.
 */
export const DemoWelcome: React.FC<DemoWelcomeProps> = ({ onReady, caption, pillsCaption }) => (
  <div className="mb-6">
    <WelcomeCard onReady={onReady} />
    <p className="mt-1 mb-5 px-1 text-[13px] leading-relaxed font-medium text-blue-100/80">{caption}</p>

    <div
      className="rounded-[20px] border px-5 py-4"
      style={{
        background: '#FDFBF2',
        borderColor: 'rgba(201, 182, 144, 0.6)',
        boxShadow: '0 28px 56px -22px rgba(0,0,0,0.45)',
      }}
    >
      <p className="text-[14px] leading-relaxed text-gray-600 font-medium">{pillsCaption}</p>
      {/* Illustration only: real markup, no interaction, hidden from AT. */}
      <div aria-hidden="true" className="pointer-events-none select-none">
        <QuickReplies onSend={noop} onFocusInput={noop} visible />
      </div>
    </div>
  </div>
);
