import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { ArrowRight } from 'lucide-react';

// Big plain "404" in the Poppins display weight used elsewhere on the site.
const FourOhFour = () => (
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

    <text
      x="160"
      y="148"
      textAnchor="middle"
      fontFamily="Poppins, sans-serif"
      fontWeight="700"
      fontSize="148"
      fill="rgba(236,228,210,0.95)"
      letterSpacing="-6"
    >
      404
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
            src="/logos/cairnly-logo-white.png"
            alt="Cairnly"
            className="h-12 sm:h-14 w-auto"
          />
        </a>

        {/* 404 numerals */}
        <FourOhFour />

        {/* Eyebrow */}
        <span
          className="font-heading uppercase text-[11px] mt-9"
          style={{ color: '#EFBE48', letterSpacing: '0.24em', fontWeight: 700 }}
        >
          You've wandered off the trail
        </span>

        {/* Headline */}
        <h1
          className="font-heading text-center text-white m-0 mt-3.5 text-[40px] sm:text-[56px]"
          style={{
            fontWeight: 700,
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
          The page you were looking for isn't here. The cairns are still on the trail. Head back to the start.
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
