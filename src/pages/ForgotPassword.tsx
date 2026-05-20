
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';

const ForgotPassword = () => {
  const { t } = useTranslation('auth');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess(false);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setError(error.message);
        return;
      }

      setSuccess(true);
    } catch (error) {
      console.error('Password reset error:', error);
      setError(t('common:errors.unexpectedError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Account recovery"
      title={success ? t('forgotPasswordPage.checkYourEmail') : t('forgotPasswordPage.title')}
    >
      {success ? (
        <div className="space-y-4 text-center">
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
          <Alert className="bg-transparent">
            <AlertDescription
              className="text-center"
              style={{ color: '#1F2937' }}
              dangerouslySetInnerHTML={{ __html: t('forgotPasswordPage.resetSent', { email }) }}
            />
          </Alert>
          <Button
            onClick={() => navigate('/auth')}
            className="w-full rounded-full bg-atlas-teal text-white hover:bg-atlas-teal/90 font-bold text-[14.5px] py-[13px] shadow-[0_10px_24px_-8px_rgba(39,161,161,0.55)]"
          >
            {t('forgotPasswordPage.backToSignIn')}
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-center" style={{ color: '#4B6373' }}>
            {t('forgotPasswordPage.sendResetLink')}
          </p>

          <div>
            <label
              htmlFor="email"
              className="block text-[13px] font-semibold mb-1.5"
              style={{ color: '#122E3B' }}
            >
              {t('forgotPasswordPage.emailLabel')}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 bg-[#FFFDF5] border-[rgba(201,182,144,0.8)] text-[#122E3B] placeholder:text-[#9CA3AF] focus-visible:ring-atlas-teal/40"
                placeholder="your@email.com"
              />
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-full bg-atlas-teal text-white hover:bg-atlas-teal/90 font-bold text-[14.5px] py-[13px] shadow-[0_10px_24px_-8px_rgba(39,161,161,0.55)]"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('forgotPasswordPage.sendResetLink')}
              </>
            ) : (
              t('forgotPasswordPage.sendResetLink')
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate('/auth')}
            className="w-full rounded-full border bg-transparent font-bold"
            style={{ color: '#1F8282', borderColor: 'rgba(31,130,130,0.32)' }}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('forgotPasswordPage.backToSignIn')}
          </Button>
        </form>
      )}
    </AuthShell>
  );
};

export default ForgotPassword;
