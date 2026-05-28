import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

// Dutch went live 2026-05-28 with the Phase 1.5 launch.
// To temporarily disable a language during a content fix, flip its `disabled` flag.
const languages = [
  { code: 'en', label: 'English', flag: '🇬🇧', disabled: false },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱', disabled: false },
] as const;

interface LanguageSwitcherProps {
  className?: string;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ className }) => {
  const { i18n } = useTranslation();
  const { pathname } = useLocation();

  // Hide the switcher on /chat to prevent mixed-language chat history mid-session.
  // Users can switch language from the dashboard before opening a chat.
  if (pathname.startsWith('/chat')) return null;

  // Pick the matching enabled language; default to English if the stored language
  // is no longer enabled (e.g. we temporarily flipped one off for a content fix).
  const currentLang = languages.find(l => l.code === i18n.language && !l.disabled) || languages[0];

  const handleChange = (code: string, disabled: boolean) => {
    if (disabled) return;
    i18n.changeLanguage(code);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={className}>
          <Globe className="h-4 w-4 mr-1" />
          <span className="text-sm">{currentLang.flag}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map(lang => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleChange(lang.code, lang.disabled)}
            disabled={lang.disabled}
            className={lang.code === i18n.language && !lang.disabled ? 'bg-gray-100' : ''}
          >
            <span className="mr-2">{lang.flag}</span>
            {lang.label}
            {lang.disabled && (
              <span className="ml-2 text-xs text-gray-400 italic">coming soon</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSwitcher;
