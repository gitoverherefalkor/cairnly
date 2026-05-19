import React from 'react';
import CairnlyWordmarkInverted from '@/logos/cairnly-logo/cairnly_logo_wordmark_inverted.png';

const LINKS = [
  { label: 'Journal', href: '/journal' },
  { label: 'Privacy', href: '/privacy-policy' },
  { label: 'Terms', href: '/terms-conditions' },
  { label: 'Support', href: '/support' },
  { label: 'Contact', href: 'mailto:info@cairnly.io' },
];

const LandingFooter: React.FC = () => (
  <footer className="bg-[#1A1A1A] text-white/60 py-14">
    <div className="lp-container">
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-8">
        <div>
          <img src={CairnlyWordmarkInverted} alt="Cairnly" className="h-14 w-auto -mb-2.5" />
          <p className="text-[10px] tracking-[0.22em] text-[#D4A024] ml-8">career path clarity.</p>
          <p className="mt-6 text-[13px] text-white/40">© Cairnly — Built in Utrecht.</p>
        </div>
        <div className="flex flex-wrap items-center gap-6 text-[13px] font-medium">
          {LINKS.map((l) => (
            <a key={l.label} href={l.href} className="hover:text-white transition-colors">
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  </footer>
);

export default LandingFooter;
