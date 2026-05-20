
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AuthShell from '@/components/auth/AuthShell';
import AuthForm from '@/components/auth/AuthForm';
import AuthToggle from '@/components/auth/AuthToggle';
import AuthNavigation from '@/components/auth/AuthNavigation';

const Auth = () => {
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
        navigate('/dashboard');
      }
    };
    checkAuth();
  }, [navigate, flowFromUrl, searchParams]);

  const handleToggle = () => {
    setIsLogin(!isLogin);
  };

  return (
    <AuthShell
      eyebrow={isLogin ? 'Welcome back' : 'Almost there'}
      title={isLogin ? 'Sign in to your account' : 'Create your account'}
      subtitle={
        !isLogin
          ? 'Your personal info stays secure in the survey, and you can easily find your results later.'
          : undefined
      }
      width={isLogin ? 'narrow' : 'wide'}
      footer={<AuthNavigation />}
    >
      <AuthForm isLogin={isLogin} />
      <AuthToggle isLogin={isLogin} onToggle={handleToggle} />
    </AuthShell>
  );
};

export default Auth;
