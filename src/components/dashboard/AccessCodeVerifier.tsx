
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Key, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

interface AccessCodeVerifierProps {
  prefilledCode?: string;
  onVerified?: () => void;
}

const AccessCodeVerifier = ({ prefilledCode, onVerified }: AccessCodeVerifierProps) => {
  const [code, setCode] = useState(prefilledCode || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation('dashboard');

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!code.trim()) {
      setError(t('accessCodeVerifier.errors.emptyCode'));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { data, error: verifyError } = await supabase.functions.invoke('verify-access-code', {
        body: { code: code.trim().toUpperCase() }
      });

      if (verifyError) {
        console.error('Verification error:', verifyError);
        throw new Error(verifyError.message);
      }

      if (!data?.valid) {
        setError(data?.error || t('accessCodeVerifier.errors.invalidCode'));
        return;
      }

      setIsVerified(true);

      if (onVerified) {
        onVerified();
      }

      // Check if user is authenticated
      if (user) {
        // User is logged in - go directly to assessment
        toast({
          title: t('accessCodeVerifier.toast.verifiedTitle'),
          description: t('accessCodeVerifier.toast.verifiedDescriptionAssessment'),
        });
        navigate('/assessment');
      } else {
        // User is NOT logged in - send to auth page to create account
        // Pass the access code in URL so it's available after signup
        toast({
          title: t('accessCodeVerifier.toast.verifiedTitle'),
          description: t('accessCodeVerifier.toast.verifiedDescriptionSignup'),
        });
        navigate(`/auth?flow=signup&code=${code.trim().toUpperCase()}`);
      }

    } catch (error) {
      console.error('Access code verification failed:', error);
      const errorMessage = t('accessCodeVerifier.errors.verifyFailed');
      setError(errorMessage);

      toast({
        title: t('accessCodeVerifier.toast.failedTitle'),
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerified) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <div className="bg-green-100 p-3 rounded-full">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-green-900">{t('accessCodeVerifier.verified.title')}</h3>
              <p className="text-sm text-green-700">
                {user
                  ? t('accessCodeVerifier.verified.redirectAssessment')
                  : t('accessCodeVerifier.verified.redirectSignup')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          {t('accessCodeVerifier.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label htmlFor="code" className="block text-sm font-medium mb-1">
              {t('accessCodeVerifier.codeLabel')}
            </label>
            <Input
              id="code"
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError('');
              }}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              className="font-mono"
              maxLength={19} // Including dashes
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={isLoading || !code.trim()} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('accessCodeVerifier.verifying')}
              </>
            ) : (
              t('accessCodeVerifier.verify')
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default AccessCodeVerifier;
