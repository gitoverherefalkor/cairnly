
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, Linkedin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { rememberPendingAccessCode } from '@/lib/pendingAccessCode';

// OAuth redirects to frontend which handles implicit flow tokens directly
// (No server-side exchange needed - we decode JWT on frontend to avoid CORS)

interface SocialAuthButtonsProps {
  disabled?: boolean;
  onError: (error: string) => void;
  highlightMethod?: string | null;
}

const SocialAuthButtons = ({ disabled, onError, highlightMethod }: SocialAuthButtonsProps) => {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isLinkedInLoading, setIsLinkedInLoading] = useState(false);
  const navigate = useNavigate();
  const { i18n } = useTranslation();

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    onError('');

    try {
      // Remember auth method before redirect
      localStorage.setItem('atlas_auth_method', 'google');
      // A code link (/auth?flow=signup&code=…) must survive the trip to the
      // provider and back, or AuthConfirm signs the person out as "no purchase".
      rememberPendingAccessCode(window.location.search, i18n.language);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Redirect to frontend which handles implicit flow tokens directly
          redirectTo: `${window.location.origin}/auth/confirm`,
        }
      });

      if (error) {
        onError(error.message);
        return;
      }

      // The redirect will happen automatically
    } catch (error) {
      console.error('Google sign-in error:', error);
      onError('Failed to sign in with Google. Please try again.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleLinkedInSignIn = async () => {
    setIsLinkedInLoading(true);
    onError('');

    try {
      // Remember auth method before redirect
      localStorage.setItem('atlas_auth_method', 'linkedin');
      // A code link (/auth?flow=signup&code=…) must survive the trip to the
      // provider and back, or AuthConfirm signs the person out as "no purchase".
      rememberPendingAccessCode(window.location.search, i18n.language);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'linkedin_oidc',
        options: {
          // Redirect to frontend which handles implicit flow tokens directly
          redirectTo: `${window.location.origin}/auth/confirm`,
        }
      });

      if (error) {
        onError(error.message);
        return;
      }

      // The redirect will happen automatically
    } catch (error) {
      console.error('LinkedIn sign-in error:', error);
      onError('Failed to sign in with LinkedIn. Please try again.');
    } finally {
      setIsLinkedInLoading(false);
    }
  };

  // OAuth buttons use standard white-card styling so the Google/LinkedIn
  // brand marks are instantly recognizable in both light and dark themes.
  // Arbitrary hex values so the global bg-white → dark-card override doesn't flip them.
  const oauthBtn = 'w-full bg-[#ffffff] hover:bg-[#f3f4f6] text-[#1f2937] border border-[#d1d5db] shadow-sm';

  return (
    <div className="grid grid-cols-2 gap-3">
      <Button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isGoogleLoading || disabled || isLinkedInLoading}
        className={`${oauthBtn} ${highlightMethod === 'google' ? 'ring-2 ring-atlas-teal ring-offset-2 ring-offset-background' : ''}`}
      >
        {isGoogleLoading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
        )}
        Google
      </Button>

      <Button
        type="button"
        onClick={handleLinkedInSignIn}
        disabled={isLinkedInLoading || disabled || isGoogleLoading}
        className={`${oauthBtn} ${highlightMethod === 'linkedin' ? 'ring-2 ring-atlas-teal ring-offset-2 ring-offset-background' : ''}`}
      >
        {isLinkedInLoading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Linkedin className="h-4 w-4 mr-2 text-[#0077B5] fill-[#0077B5]" />
        )}
        LinkedIn
      </Button>
    </div>
  );
};

export default SocialAuthButtons;
