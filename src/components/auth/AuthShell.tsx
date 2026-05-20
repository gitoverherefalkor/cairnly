import React from 'react';

interface AuthShellProps {
  /** Gold eyebrow above the title (uppercase, tracked). Optional. */
  eyebrow?: string;
  /** Big white headline shown on the dark bg, above the cream card. */
  title: string;
  /** Optional subtitle paragraph between title and card. */
  subtitle?: React.ReactNode;
  /** Form / body content rendered inside the cream card. */
  children: React.ReactNode;
  /** Footer rendered below the card on the dark bg (e.g. "Back to homepage" link). */
  footer?: React.ReactNode;
  /**
   * Card max-width. 'narrow' = 460 (sign-in/forgot/reset/confirm),
   * 'wide' = 520 (create-account / payment-success), 'xwide' = 560 (payment),
   * 'xxwide' = 640 (pre-survey upload). Or pass a number.
   */
  width?: 'narrow' | 'wide' | 'xwide' | 'xxwide' | number;
}

// Shared scaffold for /auth, /auth/confirm, /forgot-password, /reset-password.
// Pure styling shell — does not own any auth/session logic. Pages compose
// their forms inside it.
const AuthShell: React.FC<AuthShellProps> = ({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  width = 'narrow',
}) => {
  return (
    <div className="min-h-screen survey-bg">
      <div className="min-h-screen flex flex-col items-center px-6 pt-14 pb-12">
        {/* Cairnly wordmark (inverted for dark bg) */}
        <a href="/" className="inline-flex mb-7">
          <img
            src="/cairnly-logo-white.png"
            alt="Cairnly"
            className="h-12 sm:h-14 w-auto"
          />
        </a>

        {/* Optional gold editorial eyebrow */}
        {eyebrow && (
          <span
            className="font-heading uppercase text-[11px] mb-3"
            style={{
              color: '#EFBE48',
              letterSpacing: '0.24em',
              fontWeight: 900,
            }}
          >
            {eyebrow}
          </span>
        )}

        {/* Big white headline */}
        <h1
          className="font-heading text-center text-white text-[28px] sm:text-[36px] m-0 max-w-xl"
          style={{
            fontWeight: 900,
            letterSpacing: '-0.025em',
            lineHeight: 1.1,
            textWrap: 'pretty' as any,
          }}
        >
          {title}
        </h1>

        {/* Optional subtitle */}
        {subtitle && (
          <p
            className="text-center mt-3.5 max-w-lg text-[15px]"
            style={{
              color: 'rgba(255,255,255,0.72)',
              fontWeight: 500,
              lineHeight: 1.5,
              textWrap: 'pretty' as any,
            }}
          >
            {subtitle}
          </p>
        )}

        {/* Cream form card with the gold radial bloom */}
        <div
          className="relative overflow-hidden w-full mt-8 rounded-[22px] border"
          style={{
            maxWidth:
              typeof width === 'number'
                ? width
                : width === 'xxwide'
                  ? 640
                  : width === 'xwide'
                    ? 560
                    : width === 'wide'
                      ? 520
                      : 460,
            background: '#FDFBF2',
            borderColor: 'rgba(201, 182, 144, 0.6)',
            boxShadow: '0 30px 60px -24px rgba(0,0,0,0.55)',
            padding: '32px 32px 28px',
          }}
        >
          {/* Soft gold radial bloom top-right */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute"
            style={{
              top: -60,
              right: -60,
              width: 280,
              height: 280,
              background:
                'radial-gradient(circle, rgba(212,160,36,0.18) 0%, rgba(212,160,36,0) 70%)',
            }}
          />
          <div className="relative">{children}</div>
        </div>

        {/* Footer link row on the dark bg (e.g. Back to Homepage) */}
        {footer && <div className="mt-6">{footer}</div>}
      </div>
    </div>
  );
};

export default AuthShell;
