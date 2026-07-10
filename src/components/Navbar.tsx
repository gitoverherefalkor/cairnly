
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { Menu, X, User } from "lucide-react";
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import LanguageSwitcher from '@/components/LanguageSwitcher';

const Navbar = () => {
  const { t } = useTranslation('common');
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  // Nav always renders on a white background regardless of dark mode —
  // the dark mode CSS globally remaps bg-white via !important, so we use
  // inline styles here to guarantee the nav stays light on all pages.
  const navStyle = { backgroundColor: '#ffffff' };
  const linkStyle = { color: '#374151' };

  return (
    <nav className="shadow-sm sticky top-0 z-50" style={navStyle}>
      <div className="container-atlas">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center">
            <a href="/" className="flex items-center">
              <img
                src="/logos/cairnly-logo.png"
                alt="Cairnly"
                className="h-28 w-auto"
              />
            </a>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex space-x-8 items-center">
            <a href="/#how-it-works" className="hover:text-primary font-medium transition-colors" style={linkStyle}>
              {t('nav.howItWorks')}
            </a>
            <a href="/#why-atlas" className="hover:text-primary font-medium transition-colors" style={linkStyle}>
              {t('nav.whyAtlas')}
            </a>
            <a href="/#pricing" className="hover:text-primary font-medium transition-colors" style={linkStyle}>
              {t('nav.pricing')}
            </a>
            <a href="/#about" className="hover:text-primary font-medium transition-colors" style={linkStyle}>
              {t('nav.aboutUs')}
            </a>

            <LanguageSwitcher />

            {user ? (
              <Button asChild className="btn-primary">
                <button onClick={() => navigate('/dashboard')}>
                  <User className="h-4 w-4 mr-2" />
                  {t('nav.dashboard')}
                </button>
              </Button>
            ) : (
              <div className="flex space-x-2">
                <Button variant="outline" onClick={() => navigate('/auth')}>
                  {t('nav.signIn')}
                </Button>
                <Button asChild className="btn-primary">
                  <a href="/#pricing">
                    {t('nav.getStarted')}
                  </a>
                </Button>
              </div>
            )}
          </div>

          {/* Hamburger */}
          <div className="md:hidden">
            <button
              type="button"
              className="hover:text-primary transition-colors p-2"
              style={linkStyle}
              onClick={toggleMenu}
              aria-label={isOpen ? 'Close menu' : 'Open menu'}
            >
              {isOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile dropdown */}
      {isOpen && (
        <div className="md:hidden shadow-lg animate-fade-in border-t border-gray-100" style={navStyle}>
          <div className="container-atlas py-4 space-y-1">
            <a
              href="/#how-it-works"
              className="block font-medium py-3 px-2 rounded-md hover:bg-gray-50 transition-colors"
              style={linkStyle}
              onClick={toggleMenu}
            >
              {t('nav.howItWorks')}
            </a>
            <a
              href="/#why-atlas"
              className="block font-medium py-3 px-2 rounded-md hover:bg-gray-50 transition-colors"
              style={linkStyle}
              onClick={toggleMenu}
            >
              {t('nav.whyAtlas')}
            </a>
            <a
              href="/#pricing"
              className="block font-medium py-3 px-2 rounded-md hover:bg-gray-50 transition-colors"
              style={linkStyle}
              onClick={toggleMenu}
            >
              {t('nav.pricing')}
            </a>
            <a
              href="/#about"
              className="block font-medium py-3 px-2 rounded-md hover:bg-gray-50 transition-colors"
              style={linkStyle}
              onClick={toggleMenu}
            >
              {t('nav.aboutUs')}
            </a>

            <div className="flex items-center gap-3 py-3 px-2">
              <LanguageSwitcher />
            </div>

            <div className="pt-2 pb-2 space-y-2">
              {user ? (
                <Button
                  className="btn-primary w-full"
                  onClick={() => { navigate('/dashboard'); toggleMenu(); }}
                >
                  <User className="h-4 w-4 mr-2" />
                  {t('nav.dashboard')}
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => { navigate('/auth'); toggleMenu(); }}
                  >
                    {t('nav.signIn')}
                  </Button>
                  <Button asChild className="btn-primary w-full">
                    <a href="/#pricing" onClick={toggleMenu}>
                      {t('nav.getStarted')}
                    </a>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
