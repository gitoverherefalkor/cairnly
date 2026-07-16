import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useGetStarted } from './useGetStarted';
import { Menu, X, ArrowRight, Shield, Lock, Trash2 } from 'lucide-react';
import CairnlyWordmarkInverted from '@/logos/live/cairnly_logo_wordmark_inverted.png';
import LanguageSwitcher from '@/components/LanguageSwitcher';

interface LandingNavProps {
  /** 'home' enables in-page smooth-scroll for section anchors. 'page' links
   *  back to the homepage with a hash. */
  variant?: 'home' | 'page';
}

interface SectionLink {
  labelKey: string;
  hash: string;
  route?: boolean;
}

// Stable hash/route targets — labels come from i18n at render time.
const SECTION_LINKS: SectionLink[] = [
  { labelKey: 'nav.howItWorks', hash: '#how-it-works' },
  { labelKey: 'nav.methodology', hash: '#methodology' },
  { labelKey: 'nav.journal', hash: '/journal', route: true },
  { labelKey: 'nav.pricing', hash: '#pricing' },
];

const LandingNav: React.FC<LandingNavProps> = ({ variant = 'home' }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation('common');
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // On the homepage the bar stays hidden above the fold (the hero carries a
  // floating brand lockup instead) and slides in once the visitor scrolls
  // toward the fold. Other pages keep the always-visible sticky bar.
  const floating = variant === 'home';

  useEffect(() => {
    const onScroll = () =>
      setScrolled(window.scrollY > (floating ? window.innerHeight * 0.55 : 80));
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [floating]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const getStartedAction = useGetStarted();
  const getStarted = () => {
    setMenuOpen(false);
    getStartedAction();
  };

  const handleSection = (e: React.MouseEvent, link: SectionLink) => {
    setMenuOpen(false);
    if (link.route) {
      e.preventDefault();
      navigate(link.hash);
      return;
    }
    if (variant === 'home') {
      e.preventDefault();
      const target = document.querySelector(link.hash);
      // The mobile drawer locks body scroll (overflow: hidden); scrolling in
      // the same tick is a no-op. Release the lock and defer to the next frame
      // so the smooth scroll actually runs after the drawer starts closing.
      document.body.style.overflow = '';
      requestAnimationFrame(() => target?.scrollIntoView({ behavior: 'smooth' }));
    }
    // variant 'page' lets the browser follow the /#hash link to the homepage.
  };

  const hrefFor = (link: SectionLink) =>
    link.route ? link.hash : variant === 'home' ? link.hash : `/${link.hash}`;

  return (
    <>
      {/* Trust bar (pages only; the homepage opens clean on the hero image) */}
      {!floating && (
        <div className="bg-[#1A1A1A] text-white/80 py-2.5">
          <div className="lp-container flex items-center justify-center gap-x-6 gap-y-1 flex-wrap text-[11px] font-medium tracking-wide">
            <div className="flex items-center gap-2">
              <Shield size={14} strokeWidth={2} />
              <span><strong className="text-white font-semibold">{t('trust.gdpr')}</strong> · {t('trust.gdprDetail')}</span>
            </div>
            <span className="text-white/20">·</span>
            <div className="flex items-center gap-2">
              <Lock size={14} strokeWidth={2} />
              <span><strong className="text-white font-semibold">{t('trust.stripe')}</strong> · {t('trust.stripeDetail')}</span>
            </div>
            <span className="text-white/20">·</span>
            <div className="flex items-center gap-2">
              <Trash2 size={14} strokeWidth={2} />
              <span><strong className="text-white font-semibold">{t('trust.delete')}</strong> · {t('trust.deleteDetail')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Navbar: fixed + slide-in on the homepage, sticky elsewhere */}
      <nav
        className={
          floating
            ? `fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ${
                scrolled ? 'translate-y-0' : '-translate-y-full'
              }`
            : 'sticky top-0 z-50 transition-all duration-300'
        }
        style={{
          background: 'rgba(33, 63, 79, 0.96)',
          backdropFilter: 'blur(14px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="lp-container py-3 flex items-center justify-between">
          <a href="/" className="flex flex-col items-start">
            <img src={CairnlyWordmarkInverted} alt="Cairnly" className="h-14 md:h-16 w-auto -mb-2.5" />
            <span className="text-[9px] md:text-[10px] tracking-[0.22em] text-[#D4A024]">
              {t('nav.tagAuth')}
            </span>
          </a>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-7 lg:gap-8">
            {SECTION_LINKS.map((link) => (
              <a
                key={link.labelKey}
                href={hrefFor(link)}
                onClick={(e) => handleSection(e, link)}
                className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/70 hover:text-white transition-colors"
              >
                {t(link.labelKey)}
              </a>
            ))}
            {!user && (
              <a
                href="/auth"
                onClick={(e) => { e.preventDefault(); navigate('/auth'); }}
                className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/70 hover:text-white transition-colors"
              >
                {t('nav.signIn')}
              </a>
            )}
            <LanguageSwitcher className="text-white/70 hover:text-white hover:bg-white/10" />
            <button onClick={getStarted} className="lp-btn-primary" style={{ padding: '10px 22px', fontSize: 13 }}>
              {user ? t('nav.goToDashboard') : t('nav.getStarted')}
            </button>
          </div>

          {/* Mobile toggle + language switcher */}
          <div className="md:hidden flex items-center gap-1">
            <LanguageSwitcher className="text-white/70 hover:text-white hover:bg-white/10" />
            <button
              className="text-white p-2 -mr-2"
              aria-label={t('nav.openMenu')}
              onClick={() => setMenuOpen(true)}
            >
              <Menu size={26} />
            </button>
          </div>
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
            <button className="text-white p-2 -mr-2" aria-label={t('nav.closeMenu')} onClick={() => setMenuOpen(false)}>
              <X size={28} />
            </button>
          </div>
          <nav className="flex flex-col gap-7">
            {SECTION_LINKS.map((link) => (
              <a
                key={link.labelKey}
                href={hrefFor(link)}
                onClick={(e) => handleSection(e, link)}
                className="text-white text-[22px] font-heading font-bold tracking-tight"
              >
                {t(link.labelKey)}
              </a>
            ))}
            {!user && (
              <a
                href="/auth"
                onClick={(e) => { e.preventDefault(); setMenuOpen(false); navigate('/auth'); }}
                className="text-white text-[22px] font-heading font-bold tracking-tight"
              >
                {t('nav.signIn')}
              </a>
            )}
          </nav>
          <div className="mt-auto pt-8 border-t border-white/10">
            <button onClick={getStarted} className="lp-btn-primary w-full justify-center">
              {user ? t('nav.goToDashboard') : t('nav.getStarted')}
              <ArrowRight size={18} strokeWidth={2.4} />
            </button>
            <p className="text-[11px] text-white/40 mt-4 text-center">{t('trust.shortSummary')}</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default LandingNav;
