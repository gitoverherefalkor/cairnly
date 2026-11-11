
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AuthShell from '@/components/auth/AuthShell';
import AuthForm from '@/components/auth/AuthForm';
import AuthToggle from '@/components/auth/AuthToggle';
import AuthNavigation from '@/components/auth/AuthNavigation';
import { useTranslation } from 'react-i18next';
import { takePostAuthRedirect } from '@/lib/postAuthRedirect';
import { isEncoreSurveyType } from '@/components/assessment/constants';
import { setFormalDutch } from '@/lib/formalDutch';

const Auth = () => {
  const { t, i18n } = useTranslation('auth');
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(true);
  const navigate = useNavigate();

  const flowFromUrl = searchParams.get('flow');

  useEffect(() => {
    if (flowFromUrl === 'signup') {
      setIsLogin(false);
    }

    // Only check auth if NOT coming from payment flow
    // (payment flow sends users here to complete signup)
    const checkAuth = async () => {
      const accessCode = searchParams.get('code');

      // If user has access code, they're in payment flow - let them through
      if (accessCode) {
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate(takePostAuthRedirect() ?? '/dashboard');
      }
    };
    checkAuth();
  }, [navigate, flowFromUrl, searchParams]);

  // A signup link with an Encore code shows the signup page in formal Dutch
  // ("u"). Only checked when nobody is signed in: verify-access-code links an
  // unclaimed code to the signed-in caller, which must not happen from here.
  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) return;
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session || cancelled) return;
      const { data } = await supabase.functions.invoke('verify-access-code', { body: { code } });
      if (cancelled || !data?.valid) return;
      setFormalDutch(i18n, isEncoreSurveyType(data.accessCode?.survey_type));
    })().catch(() => { /* copy choice only; never block signup */ });
    return () => { cancelled = true; };
  }, [searchParams, i18n]);

  const handleToggle = () => {
    setIsLogin(!isLogin);
  };

  return (
    <AuthShell
      eyebrow={t(isLogin ? 'page.signInEyebrow' : 'page.signUpEyebrow')}
      title={t(isLogin ? 'page.signInTitle' : 'page.signUpTitle')}
      subtitle={!isLogin ? t('page.signUpSubtitle') : undefined}
      width={isLogin ? 'narrow' : 'wide'}
      footer={<AuthNavigation />}
    >
      <AuthForm isLogin={isLogin} />
      <AuthToggle isLogin={isLogin} onToggle={handleToggle} />
    </AuthShell>
  );
};

export default Auth;
