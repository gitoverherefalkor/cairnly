
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ShoppingCart, CheckCircle2, ArrowRight, Smartphone, Monitor } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import SupportDialog from '@/components/support/SupportDialog';

// Helper to get purchase data from localStorage (set after payment)
const getPurchaseData = () => {
  try {
    const stored = localStorage.getItem('purchase_data');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

interface AssessmentWelcomeProps {
  onVerified: (accessCodeData: any) => void;
  prefilledCode?: string;
}

export const AssessmentWelcome: React.FC<AssessmentWelcomeProps> = ({
  onVerified,
  prefilledCode
}) => {
  // Check for access code from purchase data in localStorage
  const purchaseData = getPurchaseData();
  const initialCode = prefilledCode || purchaseData?.accessCode || '';

  const [code, setCode] = useState(initialCode);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [needsPurchase, setNeedsPurchase] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { t } = useTranslation('survey');

  // Set the prefilled code when component mounts or prefilledCode changes
  useEffect(() => {
    if (prefilledCode) {
      setCode(prefilledCode);
    } else if (purchaseData?.accessCode && !code) {
      setCode(purchaseData.accessCode);
    }
  }, [prefilledCode]);

  const handleVerify = async () => {
    if (!code.trim()) {
      setError(t('assessmentWelcome.errors.emptyCode'));
      return;
    }

    setIsVerifying(true);
    setError('');
    setNeedsPurchase(false);

    try {
      const { data, error: apiError } = await supabase.functions.invoke('verify-access-code', {
        body: { code: code.trim() }
      });

      if (apiError) {
        console.error('API error:', apiError);
        setError(t('assessmentWelcome.errors.verifyFailed'));
        return;
      }

      if (data.valid) {
        // Access code verified — clean up purchase_data, no longer needed
        localStorage.removeItem('purchase_data');
        onVerified(data.accessCode);
      } else {
        setError(data.error);
        setNeedsPurchase(data.needsPurchase || false);
      }
    } catch (error) {
      console.error('Error verifying access code:', error);
      setError(t('assessmentWelcome.errors.verifyFailed'));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleVerify();
    }
  };

  const formatCode = (value: string) => {
    // Remove any non-alphanumeric characters except hyphens
    const cleaned = value.replace(/[^a-zA-Z0-9-]/g, '');
    // Convert to uppercase
    return cleaned.toUpperCase();
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCode(e.target.value);
    setCode(formatted);
    setError('');
    setNeedsPurchase(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Mobile Warning */}
        {isMobile && (
          <Alert className="mb-6 border-amber-200 bg-amber-50">
            <Smartphone className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <strong>{t('assessmentWelcome.mobileWarning.title')}</strong>{' '}
              {t('assessmentWelcome.mobileWarning.body')}
            </AlertDescription>
          </Alert>
        )}

        {/* Welcome Header — cream text: this sits directly on the dark
            teal-navy canvas, so dark `text-atlas-navy` would be illegible. */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-[#F5F5F5] mb-4">
            {t('assessmentWelcome.hero.title')}
          </h1>
          {/* Copy is flavor-neutral: this screen renders before the access code
              is verified, so we can't know yet if it's a pro or starter user. */}
          <p className="text-xl text-[#F5F5F5]/80 max-w-lg mx-auto">
            {t('assessmentWelcome.hero.subtitle')}
          </p>
        </div>

        {/* Main Card */}
        <Card className="w-full">
          <CardHeader className="text-center pb-4">
            <div className="flex items-center justify-center gap-2 mb-4">
              <CheckCircle2 className="h-6 w-6 text-atlas-teal" />
              <span className="text-lg font-semibold text-atlas-navy">{t('assessmentWelcome.card.badge')}</span>
            </div>
            <p className="text-gray-600">
              {t('assessmentWelcome.card.subtitle')}
            </p>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Access Code Input */}
            <div className="space-y-2">
              <label htmlFor="access-code" className="text-sm font-medium text-gray-700">
                {t('assessmentWelcome.accessCode.label')}
              </label>
              <Input
                id="access-code"
                type="text"
                placeholder={t('assessmentWelcome.accessCode.placeholder')}
                value={code}
                onChange={handleCodeChange}
                onKeyPress={handleKeyPress}
                className="text-center font-mono text-lg tracking-wider py-3"
                maxLength={50}
              />
              <p className="text-xs text-gray-500 text-center">
                {t('assessmentWelcome.accessCode.hint')}
              </p>
            </div>

            {/* Error Display */}
            {error && (
              <Alert variant={needsPurchase ? "destructive" : "default"}>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Main Action Button */}
            <Button 
              onClick={handleVerify} 
              disabled={isVerifying || !code.trim()}
              className="w-full py-3 text-lg font-semibold"
              size="lg"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  {t('assessmentWelcome.actions.verifying')}
                </>
              ) : (
                <>
                  {t('assessmentWelcome.actions.verify')}
                  <ArrowRight className="h-5 w-5 ml-2" />
                </>
              )}
            </Button>

            {/* Purchase Option */}
            {needsPurchase && (
              <div className="text-center pt-4 border-t">
                <p className="text-sm text-gray-600 mb-3">
                  {t('assessmentWelcome.purchase.prompt')}
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/')}
                  className="w-full"
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  {t('assessmentWelcome.purchase.cta')}
                </Button>
              </div>
            )}

            {/* Help Section */}
            <div className="text-center pt-4 border-t">
              <p className="text-xs text-gray-500">
                {t('assessmentWelcome.help.prefix')}{' '}
                <button
                  onClick={() => setSupportOpen(true)}
                  className="text-atlas-blue hover:underline font-medium"
                >
                  {t('assessmentWelcome.help.contactSupport')}
                </button>{' '}
                {t('assessmentWelcome.help.or')}{' '}
                <button
                  onClick={() => navigate('/')}
                  className="text-atlas-blue hover:underline font-medium"
                >
                  {t('assessmentWelcome.help.returnHome')}
                </button>
              </p>
            </div>
            <SupportDialog open={supportOpen} onOpenChange={setSupportOpen} />
          </CardContent>
        </Card>

        {/* Assessment Info — also on the dark canvas: subtle tinted boxes
            with cream text instead of the milky bg-white/50 + dark text. */}
        <div className="mt-8 text-center">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
            {/* 15-20 minutes was not achievable on any flavor: the pro survey
                alone is 61 questions, including five work experiences that each
                want a written answer. Beta testers consistently ran far over and
                said the low estimate undersold the depth. This screen renders
                before the access code is verified, so it cannot know the flavor
                (pro 61 / encore 41 / starter 40 questions) and has to hold one
                range for all three. We deliberately err long: finishing early
                is a pleasant surprise, running double the promise is not. */}
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-2xl font-bold text-atlas-teal mb-1">⏱️</div>
              <div className="text-sm font-medium text-[#F5F5F5]">{t('assessmentWelcome.info.duration.value')}</div>
              <div className="text-xs text-[#F5F5F5]/60">{t('assessmentWelcome.info.duration.caption')}</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-2xl font-bold text-atlas-teal mb-1">📊</div>
              <div className="text-sm font-medium text-[#F5F5F5]">{t('assessmentWelcome.info.sections.value')}</div>
              <div className="text-xs text-[#F5F5F5]/60">{t('assessmentWelcome.info.sections.caption')}</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-2xl font-bold text-atlas-teal mb-1">🎯</div>
              <div className="text-sm font-medium text-[#F5F5F5]">{t('assessmentWelcome.info.personalized.value')}</div>
              <div className="text-xs text-[#F5F5F5]/60">{t('assessmentWelcome.info.personalized.caption')}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
