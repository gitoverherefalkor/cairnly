import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { ArrowRight } from 'lucide-react';

// Big "404" rendered as two ink-cream "4"s with a stylized cairn replacing the 0.
const CairnFourOhFour = () => (
  <svg
    width="320"
    height="180"
    viewBox="0 0 320 180"
    fill="none"
    className="max-w-full h-auto"
    aria-hidden="true"
  >
    {/* Ground line */}
    <line
      x1="20"
      y1="166"
      x2="300"
      y2="166"
      stroke="rgba(236,228,210,0.25)"
      strokeWidth="1"
      strokeDasharray="4 6"
    />

    {/* "4" — left */}
    <text
      x="48"
      y="148"
      fontFamily="Poppins, sans-serif"
      fontWeight="900"
      fontSize="148"
      fill="rgba(236,228,210,0.95)"
      letterSpacing="-6"
    >
      4
    </text>

    {/* "0" — cairn stack */}
    <g transform="translate(160, 100)">
      <ellipse cx="0" cy="58" rx="38" ry="10" fill="rgba(236,228,210,0.20)" stroke="rgba(236,228,210,0.85)" strokeWidth="1.4" />
      <ellipse cx="-2" cy="40" rx="30" ry="9" fill="rgba(236,228,210,0.20)" stroke="rgba(236,228,210,0.85)" strokeWidth="1.4" />
      <ellipse cx="3" cy="22" rx="22" ry="7.5" fill="rgba(236,228,210,0.20)" stroke="rgba(236,228,210,0.85)" strokeWidth="1.4" />
      <ellipse cx="-1" cy="4" rx="16" ry="6" fill="rgba(212,160,36,0.30)" stroke="#EFBE48" strokeWidth="1.6" />
      <circle cx="0" cy="-12" r="6" fill="#EFBE48" />
    </g>

    {/* "4" — right */}
    <text
      x="218"
      y="148"
      fontFamily="Poppins, sans-serif"
      fontWeight="900"
      fontSize="148"
      fill="rgba(236,228,210,0.95)"
      letterSpacing="-6"
    >
      4
    </text>
  </svg>
);

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      '404 Error: User attempted to access non-existent route:',
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen survey-bg">
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16">
        {/* Wordmark */}
        <a href="/" className="inline-flex mb-9">
          <img
            src="/cairnly-logo-white.png"
            alt="Cairnly"
            className="h-12 sm:h-14 w-auto"
          />
        </a>

        {/* Cairn 404 illustration */}
        <CairnFourOhFour />

        {/* Eyebrow */}
        <span
          className="font-heading uppercase text-[11px] mt-9"
          style={{ color: '#EFBE48', letterSpacing: '0.24em', fontWeight: 900 }}
        >
          You've wandered off the trail
        </span>

        {/* Headline */}
        <h1
          className="font-heading text-center text-white m-0 mt-3.5 text-[40px] sm:text-[56px]"
          style={{
            fontWeight: 900,
            letterSpacing: '-0.03em',
            lineHeight: 1,
            textWrap: 'pretty' as any,
            maxWidth: 720,
          }}
        >
          This path doesn't exist.
        </h1>

        {/* Subhead */}
        <p
          className="text-center mt-4 max-w-xl text-[17px]"
          style={{
            color: 'rgba(255,255,255,0.72)',
            fontWeight: 500,
            lineHeight: 1.55,
            textWrap: 'pretty' as any,
          }}
        >
          The page you were looking for isn't here. The cairns are still on the trail — head back to the start.
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap gap-3 mt-8 justify-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full bg-atlas-teal text-white font-bold text-[14px] px-[22px] py-[13px] shadow-[0_10px_24px_-8px_rgba(39,161,161,0.55)] hover:bg-atlas-teal/90 transition-colors"
          >
            Back to homepage <ArrowRight className="h-[15px] w-[15px]" />
          </Link>
          <Link
            to="/journal"
            className="inline-flex items-center gap-2 rounded-full text-white font-semibold text-[14px] px-5 py-[13px] border border-white/20 hover:bg-white/10 transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            Read the journal
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
