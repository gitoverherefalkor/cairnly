import React from 'react';
import { useIntent } from '@/contexts/IntentContext';
import { useIntakeChatOptional } from './IntakeChatContext';
import { PITCH_SHOT_SRC } from './intakeSlides';

/**
 * The product screenshot shown beside the package card once the intake pitch
 * lands, so the decision moment keeps a real product visual (the carousel is
 * unmounted at this stage). Matched to the conversation's intent — which can
 * diverge from the pill intent (e.g. "Something else" runs as 'other') — with
 * the pill intent as fallback and 'other'/unknown falling back to the
 * dashboard shot.
 */
const PitchScreenshot: React.FC = () => {
  const { intent } = useIntent();
  const chat = useIntakeChatOptional();
  const src = PITCH_SHOT_SRC[chat?.intent ?? intent] ?? PITCH_SHOT_SRC.default;
  return (
    <div
      className="mx-auto mb-6 w-full max-w-[560px] overflow-hidden rounded-2xl"
      style={{ border: '1px solid rgba(255,255,255,0.10)', boxShadow: '0 30px 60px -24px rgba(0,0,0,0.5)' }}
    >
      <img src={src} alt="Cairnly dashboard preview" className="block w-full h-auto" loading="lazy" />
    </div>
  );
};

export default PitchScreenshot;
