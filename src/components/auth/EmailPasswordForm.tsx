import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, Lock, User, Eye, EyeOff, CheckCircle, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getPostAuthRedirect } from '@/hooks/useAuth';

interface EmailPasswordFormProps {
  isLogin: boolean;
  disabled?: boolean;
}

// Helper to get purchase data from URL params OR localStorage
const getPurchaseData = () => {
  try {
    // First check URL params (from AccessCodeVerifier redirect)
    const urlParams = new URLSearchParams(window.location.search);
    const urlEmail = urlParams.get('email');
    const urlFirstName = urlParams.get('firstName');
    const urlLastName = urlParams.get('lastName');
    const urlAccessCode = urlParams.get('code');

    if (urlEmail || urlFirstName || urlLastName) {
      return {
        email: urlEmail || '',
        firstName: urlFirstName || '',
        lastName: urlLastName || '',
        accessCode: urlAccessCode || ''
      };
    }

    // Fallback to localStorage (set after payment on PaymentSuccess page)
    const stored = localStorage.getItem('purchase_data');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const EmailPasswordForm = ({ isLogin, disabled }: EmailPasswordFormProps) => {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [sentToEmail, setSentToEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: ''
  });

  // Memoize purchase data - only read from URL/localStorage once
  const purchaseData = useMemo(() => getPurchaseData(), []);

  // Prefill form when in signup mode with purchase data
  useEffect(() => {
    if (!isLogin && purchaseData) {
      setFormData(prev => ({
        ...prev,
        email: purchaseData.email || prev.email,
        firstName: purchaseData.firstName || prev.firstName,
        lastName: purchaseData.lastName || prev.lastName
      }));
    }
  }, [isLogin, purchaseData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password
        });

        if (error) {
          setError(error.message);
          return;
        }

        if (data.user) {
          localStorage.setItem('atlas_auth_method', 'email');
          toast({
            title: t('toasts.welcomeBack'),
            description: t('toasts.loggedInSuccess'),
          });
          // ensureProfile may have set the new-user flag via onAuthStateChange
          // Give it a tick to run, then consume the flag
          await new Promise(r => setTimeout(r, 100));
          navigate(getPostAuthRedirect());
        }
      } else {
        // Verify passwords match
        if (formData.password !== formData.confirmPassword) {
          setError(t('errors.passwordsDoNotMatch'));
          return;
        }

        // Check if user has an access code from URL params or purchase data
        const urlParams = new URLSearchParams(window.location.search);
        const accessCode = urlParams.get('code') || purchaseData?.accessCode;

        // If no access code, prevent signup
        if (!accessCode) {
          setError(t('errors.needAccessCode'));
          return;
        }

        // Create pre-verified account via edge function (no email verification needed —
        // the access code was already emailed, proving email ownership)
        const { data: signupData, error: signupError } = await supabase.functions.invoke(
          'signup-with-access-code',
          {
            body: {
              email: formData.email,
              password: formData.password,
              firstName: formData.firstName,
              lastName: formData.lastName,
              accessCode: accessCode
            }
          }
        );

        if (signupError) {
          setError(signupError.message || t('errors.failedToCreate'));
          return;
        }

        if (signupData?.error) {
          setError(signupData.error);
          return;
        }

        if (signupData?.success) {
          // User created with confirmed email — sign in to establish session
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: formData.email,
            password: formData.password
          });

          if (signInError) {
            // Rare edge case: user was created but sign-in failed (network/timing)
            setError(t('errors.accountCreatedSignIn'));
            return;
          }

          if (signInData.user) {
            localStorage.setItem('atlas_auth_method', 'email');
            toast({
              title: t('toasts.accountCreated'),
              description: t('toasts.welcomeToAtlas'),
            });
            navigate('/dashboard');
          }
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
      setError(t('common:errors.unexpectedError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendEmail = async () => {
    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: sentToEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        }
      });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: t('toasts.emailSent'), description: t('toasts.newVerificationSent') });
      }
    } catch {
      toast({ title: "Error", description: "Failed to resend. Please try again.", variant: "destructive" });
    } finally {
      setIsResending(false);
    }
  };

  // Show confirmation screen after successful signup
  if (emailSent) {
    return (
      <div className="text-center space-y-4 py-2">
        <div className="flex justify-center">
          <div
            className="h-[72px] w-[72px] rounded-full flex items-center justify-center border"
            style={{
              background: 'rgba(34,197,94,0.12)',
              borderColor: 'rgba(34,197,94,0.32)',
            }}
          >
            <CheckCircle className="h-8 w-8" style={{ color: '#16A34A' }} />
          </div>
        </div>
        <div>
          <h3 className="text-lg font-bold" style={{ color: '#122E3B' }}>
            {t('emailVerification.checkYourEmail')}
          </h3>
          <p className="text-sm mt-1" style={{ color: '#4B6373' }}>
            {t('emailVerification.weSentLink')}
          </p>
          <p className="text-sm font-semibold mt-1" style={{ color: '#122E3B' }}>{sentToEmail}</p>
        </div>
        <p className="text-xs" style={{ color: '#6B7F8B' }}>
          {t('emailVerification.clickLink')}
        </p>
        <div className="pt-2 space-y-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResendEmail}
            disabled={isResending}
            className="w-full rounded-full border-[rgba(31,130,130,0.32)] bg-transparent font-bold"
            style={{ color: '#1F8282' }}
          >
            {isResending ? (
              <><Loader2 className="h-3 w-3 mr-2 animate-spin" /> {t('emailVerification.sending')}</>
            ) : (
              <><RefreshCw className="h-3 w-3 mr-2" /> {t('emailVerification.resend')}</>
            )}
          </Button>
          <p className="text-xs" style={{ color: '#9CA3AF' }}>
            {t('emailVerification.didntReceive')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!isLogin && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="firstName" className="block text-[13px] font-semibold mb-1.5 text-[#122E3B]">
              {t('firstName')}
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="firstName"
                name="firstName"
                type="text"
                required={!isLogin}
                value={formData.firstName}
                onChange={handleInputChange}
                className="pl-10 bg-[#FFFDF5] border-[rgba(201,182,144,0.8)] text-[#122E3B] placeholder:text-[#9CA3AF] focus-visible:ring-atlas-teal/40"
                placeholder={t('placeholders.firstName')}
              />
            </div>
          </div>
          <div>
            <label htmlFor="lastName" className="block text-[13px] font-semibold mb-1.5 text-[#122E3B]">
              {t('lastName')}
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="lastName"
                name="lastName"
                type="text"
                required={!isLogin}
                value={formData.lastName}
                onChange={handleInputChange}
                className="pl-10 bg-[#FFFDF5] border-[rgba(201,182,144,0.8)] text-[#122E3B] placeholder:text-[#9CA3AF] focus-visible:ring-atlas-teal/40"
                placeholder={t('placeholders.lastName')}
              />
            </div>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-[13px] font-semibold mb-1.5 text-[#122E3B]">
          {t('email')}
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            id="email"
            name="email"
            type="email"
            required
            value={formData.email}
            onChange={handleInputChange}
            className="pl-10 bg-[#FFFDF5] border-[rgba(201,182,144,0.8)] text-[#122E3B] placeholder:text-[#9CA3AF] focus-visible:ring-atlas-teal/40"
            placeholder={t('placeholders.email')}
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="password" className="block text-sm font-medium">
            {t('password')}
          </label>
          {isLogin && (
            <button
              type="button"
              onClick={() => navigate('/forgot-password')}
              className="text-xs font-semibold hover:underline"
              style={{ color: '#1F8282' }}
            >
              {t('forgotPassword')}
            </button>
          )}
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            value={formData.password}
            onChange={handleInputChange}
            className="pl-10 pr-10 bg-[#FFFDF5] border-[rgba(201,182,144,0.8)] text-[#122E3B] placeholder:text-[#9CA3AF] focus-visible:ring-atlas-teal/40"
            placeholder={isLogin ? t('placeholders.enterPassword') : t('placeholders.createPassword')}
            minLength={8}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {!isLogin && (
          <p className="text-[11.5px] font-medium mt-1.5" style={{ color: '#6B7F8B' }}>
            {t('passwordMinLength')}
          </p>
        )}
      </div>

      {!isLogin && (
        <div>
          <label htmlFor="confirmPassword" className="block text-[13px] font-semibold mb-1.5 text-[#122E3B]">
            {t('confirmPassword')}
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type={showPassword ? "text" : "password"}
              required
              value={formData.confirmPassword}
              onChange={handleInputChange}
              className="pl-10 bg-[#FFFDF5] border-[rgba(201,182,144,0.8)] text-[#122E3B] placeholder:text-[#9CA3AF] focus-visible:ring-atlas-teal/40"
              placeholder={t('placeholders.repeatPassword')}
              minLength={8}
            />
          </div>
        </div>
      )}

      {error && (
        <Alert variant={error.includes('verification') ? "default" : "destructive"}>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        disabled={isLoading || disabled}
        className="w-full mt-1 rounded-full bg-atlas-teal text-white hover:bg-atlas-teal/90 font-bold text-[14.5px] py-[13px] shadow-[0_10px_24px_-8px_rgba(39,161,161,0.55)]"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {isLogin ? t('signingIn') : t('creatingAccount')}
          </>
        ) : (
          isLogin ? t('signIn') : t('createAccount')
        )}
      </Button>
    </form>
  );
};

export default EmailPasswordForm;
