import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Menu, X, ArrowRight, Shield, Lock, Trash2 } from 'lucide-react';
import CairnlyWordmarkInverted from '@/logos/cairnly-logo/cairnly_logo_wordmark_inverted.png';

interface LandingNavProps {
  /** 'home' enables in-page smooth-scroll for section anchors. 'page' links
   *  back to the homepage with a hash. */
  variant?: 'home' | 'page';
}

const SECTION_LINKS = [
  { label: 'How it works', hash: '#how-it-works' },
  { label: 'Methodology', hash: '#methodology' },
  { label: 'Journal', hash: '/journal', route: true },
  { label: 'Pricing', hash: '#pricing' },
];

const LandingNav: React.FC<LandingNavProps> = ({ variant = 'home' }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const getStarted = () => {
    setMenuOpen(false);
    navigate(user ? '/dashboard' : '/payment');
  };

  const handleSection = (e: React.MouseEvent, link: typeof SECTION_LINKS[number]) => {
    setMenuOpen(false);
    if (link.route) {
      e.preventDefault();
      navigate(link.hash);
      return;
    }
    if (variant === 'home') {
      e.preventDefault();
      document.querySelector(link.hash)?.scrollIntoView({ behavior: 'smooth' });
    }
    // variant 'page' lets the browser follow the /#hash link to the homepage.
  };

  const hrefFor = (link: typeof SECTION_LINKS[number]) =>
    link.route ? link.hash : variant === 'home' ? link.hash : `/${link.hash}`;

  return (
    <>
      {/* Trust bar */}
      <div className="bg-[#1A1A1A] text-white/80 py-2.5">
        <div className="lp-container flex items-center justify-center gap-x-6 gap-y-1 flex-wrap text-[11px] font-medium tracking-wide">
          <div className="flex items-center gap-2">
            <Shield size={14} strokeWidth={2} />
            <span><strong className="text-white font-semibold">GDPR compliant</strong> · European servers</span>
          </div>
          <span className="text-white/20">·</span>
          <div className="flex items-center gap-2">
            <Lock size={14} strokeWidth={2} />
            <span><strong className="text-white font-semibold">Payments by Stripe</strong> · We never see your card</span>
          </div>
          <span className="text-white/20">·</span>
          <div className="flex items-center gap-2">
            <Trash2 size={14} strokeWidth={2} />
            <span><strong className="text-white font-semibold">One-click delete</strong> · Your data is yours</span>
          </div>
        </div>
      </div>

      {/* Navbar */}
      <nav
        className="sticky top-0 z-50 transition-all duration-300"
        style={{
          background: 'rgba(33, 63, 79, 0.96)',
          backdropFilter: 'blur(14px)',
          borderBottom: scrolled
            ? '1px solid rgba(255,255,255,0.06)'
            : '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="lp-container py-3 flex items-center justify-between">
          <a href="/" className="flex flex-col items-start">
            <img src={CairnlyWordmarkInverted} alt="Cairnly" className="h-14 md:h-16 w-auto -mb-2.5" />
            <span className="text-[9px] md:text-[10px] tracking-[0.22em] text-[#D4A024] ml-8 md:ml-9">
              career path clarity.
            </span>
          </a>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-7 lg:gap-8">
            {SECTION_LINKS.map((link) => (
              <a
                key={link.label}
                href={hrefFor(link)}
                onClick={(e) => handleSection(e, link)}
                className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/70 hover:text-white transition-colors"
              >
                {link.label}
              </a>
            ))}
            {!user && (
              <a
                href="/auth"
                onClick={(e) => { e.preventDefault(); navigate('/auth'); }}
                className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/70 hover:text-white transition-colors"
              >
                Sign in
              </a>
            )}
            <button onClick={getStarted} className="lp-btn-primary" style={{ padding: '10px 22px', fontSize: 13 }}>
              {user ? 'Go to dashboard' : 'Get Started — €39'}
            </button>
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden text-white p-2 -mr-2"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={26} />
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      <div
        className="fixed inset-0 z-[200] md:hidden"
        style={{
          background: 'rgba(18, 46, 59, 0.98)',
          backdropFilter: 'blur(14px)',
          transform: menuOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div className="h-full flex flex-col p-6">
          <div className="flex items-center justify-between mb-12">
            <img src={CairnlyWordmarkInverted} alt="Cairnly" className="h-12 w-auto" />
            <button className="text-white p-2 -mr-2" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
              <X size={28} />
            </button>
          </div>
          <nav className="flex flex-col gap-7">
            {SECTION_LINKS.map((link) => (
              <a
                key={link.label}
                href={hrefFor(link)}
                onClick={(e) => handleSection(e, link)}
                className="text-white text-[22px] font-heading font-bold tracking-tight"
              >
                {link.label}
              </a>
            ))}
            {!user && (
              <a
                href="/auth"
                onClick={(e) => { e.preventDefault(); setMenuOpen(false); navigate('/auth'); }}
                className="text-white text-[22px] font-heading font-bold tracking-tight"
              >
                Sign in
              </a>
            )}
          </nav>
          <div className="mt-auto pt-8 border-t border-white/10">
            <button onClick={getStarted} className="lp-btn-primary w-full justify-center">
              {user ? 'Go to dashboard' : 'Get Started — €39'}
              <ArrowRight size={18} strokeWidth={2.4} />
            </button>
            <p className="text-[11px] text-white/40 mt-4 text-center">No subscription · GDPR · Stripe</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default LandingNav;
