
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AuthShell from '@/components/auth/AuthShell';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Check if user has a profile (existing user) or is brand new.
// Returns '/payment' for new users, '/dashboard' for returning users.
async function resolvePostAuthRedirect(userId: string): Promise<string> {
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();
  return data ? '/dashboard' : '/payment';
}

const AuthConfirm = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleAuthConfirm = async () => {
      // Check for error in query params (from Edge Function)
      const errorParam = searchParams.get('error');
      if (errorParam) {
        setStatus('error');
        setMessage(errorParam);
        return;
      }

      // Read hash fragment params (used for both Edge Function session and OAuth implicit flow)
      // SECURITY: Session data is passed in the hash fragment, not query string.
      // Hash fragments are never sent to servers or in referrer headers.
      const hashParams = new URLSearchParams(window.location.hash.substring(1));

      // Check for session data from Edge Function (base64 encoded in hash fragment)
      const sessionParam = hashParams.get('session');
      if (sessionParam) {
        try {
          console.log('Found session from Edge Function');

          // Decode the base64 session data
          const sessionData = JSON.parse(atob(decodeURIComponent(sessionParam)));
          console.log('Session decoded for user:', sessionData.user?.email);

          // Store the complete session in localStorage (Supabase format)
          const storageKey = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
          localStorage.setItem(storageKey, JSON.stringify(sessionData));
          console.log('Full session stored in localStorage');

          // Clear the hash from URL
          window.history.replaceState(null, '', window.location.pathname);

          setStatus('success');
          setMessage('Successfully signed in!');

          // Route new users to /payment, returning users to /dashboard
          const dest = await resolvePostAuthRedirect(sessionData.user?.id);
          setTimeout(() => {
            window.location.href = dest;
          }, 1000);
          return;
        } catch (err) {
          console.error('Error parsing session:', err);
          setStatus('error');
          setMessage('Failed to process sign in. Please try again.');
          return;
        }
      }

      // Handle implicit OAuth flow (tokens in URL hash) - this is what Supabase returns
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const expiresAt = hashParams.get('expires_at');
      const expiresIn = hashParams.get('expires_in');

      if (accessToken && refreshToken) {
        try {
          console.log('Found OAuth tokens in hash (implicit flow)');

          // Decode the JWT to get user data (no API call needed!)
          const payload = JSON.parse(atob(accessToken.split('.')[1]));
          console.log('JWT decoded for user:', payload.email);

          // Build user object from JWT payload
          const user = {
            id: payload.sub,
            email: payload.email,
            phone: payload.phone || '',
            app_metadata: payload.app_metadata || {},
            user_metadata: payload.user_metadata || {},
            aud: payload.aud,
            role: payload.role,
            created_at: '',
            updated_at: '',
          };

          // Build complete session
          const sessionData = {
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_at: parseInt(expiresAt || '0') || Math.floor(Date.now() / 1000) + parseInt(expiresIn || '3600'),
            expires_in: parseInt(expiresIn || '3600'),
            token_type: 'bearer',
            user: user,
          };

          // Store in localStorage
          const storageKey = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
          localStorage.setItem(storageKey, JSON.stringify(sessionData));
          console.log('Full session stored in localStorage');

          // Clear the hash from URL
          window.history.replaceState(null, '', window.location.pathname);

          setStatus('success');
          setMessage('Successfully signed in!');

          // Route new users to /payment, returning users to /dashboard
          const dest = await resolvePostAuthRedirect(user.id);
          setTimeout(() => {
            window.location.href = dest;
          }, 1000);
          return;
        } catch (err) {
          console.error('Error processing OAuth tokens:', err);
          setStatus('error');
          setMessage('Failed to process sign in. Please try again.');
          return;
        }
      }

      // Handle PKCE code flow (if coming directly from Supabase, not Edge Function)
      const hasCode = searchParams.has('code');
      if (hasCode) {
        // This path shouldn't happen with the Edge Function approach
        // but keep as fallback
        console.log('Code param detected - redirecting through edge function');
        setStatus('error');
        setMessage('Please use social login buttons to sign in.');
        return;
      }

      // Handle email confirmation and password reset
      const token = searchParams.get('token');
      const type = searchParams.get('type');

      if (!token || !type) {
        // Check if user is already logged in
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const dest = await resolvePostAuthRedirect(session.user.id);
          navigate(dest);
          return;
        }

        setStatus('error');
        setMessage('Invalid confirmation link. Please try signing up again.');
        return;
      }

      try {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: type as any,
        });

        if (error) {
          console.error('Confirmation error:', error);
          setStatus('error');
          setMessage(error.message || 'Failed to confirm your email. Please try again.');
          return;
        }

        if (data.user) {
          // If this is a password reset (recovery), redirect to reset password page
          if (type === 'recovery') {
            navigate('/reset-password');
            return;
          }

          // Regular email confirmation
          setStatus('success');
          setMessage('Your email has been confirmed successfully!');

          // Route new users to /payment, returning users to /dashboard
          const dest = await resolvePostAuthRedirect(data.user.id);
          setTimeout(() => {
            navigate(dest);
          }, 2000);
        }
      } catch (error) {
        console.error('Unexpected error during confirmation:', error);
        setStatus('error');
        setMessage('An unexpected error occurred. Please try again.');
      }
    };

    handleAuthConfirm();
  }, [searchParams, navigate]);

  const titleByStatus =
    status === 'loading'
      ? 'Confirming your email…'
      : status === 'success'
        ? 'Email Confirmed!'
        : 'Confirmation Failed';

  const iconCircleStyles =
    status === 'success'
      ? { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.32)', color: '#16A34A' }
      : status === 'error'
        ? { bg: 'rgba(220,38,38,0.10)', border: 'rgba(220,38,38,0.28)', color: '#DC2626' }
        : { bg: 'rgba(39,161,161,0.10)', border: 'rgba(39,161,161,0.30)', color: '#1F8282' };

  return (
    <AuthShell eyebrow="Email confirmation" title={titleByStatus}>
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div
            className="h-[72px] w-[72px] rounded-full flex items-center justify-center border"
            style={{ background: iconCircleStyles.bg, borderColor: iconCircleStyles.border }}
          >
            {status === 'loading' && (
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: iconCircleStyles.color }} />
            )}
            {status === 'success' && (
              <CheckCircle className="h-8 w-8" style={{ color: iconCircleStyles.color }} />
            )}
            {status === 'error' && (
              <XCircle className="h-8 w-8" style={{ color: iconCircleStyles.color }} />
            )}
          </div>
        </div>

        <Alert variant={status === 'error' ? 'destructive' : 'default'} className="bg-transparent">
          <AlertDescription className="text-center" style={{ color: '#1F2937' }}>
            {message}
          </AlertDescription>
        </Alert>

        {status === 'success' && (
          <p className="text-sm" style={{ color: '#4B6373' }}>
            Redirecting you to your dashboard…
          </p>
        )}

        {status === 'error' && (
          <div className="mt-2 space-y-2">
            <Button
              onClick={() => navigate('/auth')}
              className="w-full rounded-full bg-atlas-teal text-white hover:bg-atlas-teal/90 font-bold text-[14.5px] py-[13px] shadow-[0_10px_24px_-8px_rgba(39,161,161,0.55)]"
            >
              Try Signing Up Again
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="w-full rounded-full border bg-transparent font-bold"
              style={{ color: '#1F8282', borderColor: 'rgba(31,130,130,0.32)' }}
            >
              Back to Homepage
            </Button>
          </div>
        )}
      </div>
    </AuthShell>
  );
};

export default AuthConfirm;
