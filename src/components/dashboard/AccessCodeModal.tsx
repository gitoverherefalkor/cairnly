import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, ArrowRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SupportDialog from '@/components/support/SupportDialog';

interface AccessCodeModalProps {
  accessCode: string;
  onClose: () => void;
}

export const AccessCodeModal: React.FC<AccessCodeModalProps> = ({
  accessCode: initialCode,
  onClose
}) => {
  const [code, setCode] = useState(initialCode);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [supportOpen, setSupportOpen] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation('dashboard');

  const handleVerify = async () => {
    if (!code.trim()) {
      setError(t('accessCodeModal.errors.emptyCode'));
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      const { data, error: apiError } = await supabase.functions.invoke('verify-access-code', {
        body: { code: code.trim() }
      });

      if (apiError) {
        console.error('API error:', apiError);
        setError(t('accessCodeModal.errors.verifyFailed'));
        return;
      }

      if (data.valid) {
        // Store verification in localStorage for the assessment page
        const session = {
          isVerified: true,
          accessCodeData: data.accessCode,
          sessionToken: data.accessCode.id,
          currentSectionIndex: 0,
          currentQuestionIndex: 0,
          responses: {}
        };
        localStorage.setItem('assessment_session', JSON.stringify(session));
        navigate('/assessment');
      } else {
        setError(data.error || t('accessCodeModal.errors.invalidCode'));
      }
    } catch (error) {
      console.error('Error verifying access code:', error);
      setError(t('accessCodeModal.errors.verifyFailed'));
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
    const cleaned = value.replace(/[^a-zA-Z0-9-]/g, '');
    return cleaned.toUpperCase();
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCode(e.target.value);
    setCode(formatted);
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />

      {/* Modal */}
      <Card className="relative z-10 w-full max-w-lg mx-4 shadow-2xl">
        <button
          onClick={onClose}
          aria-label={t('accessCodeModal.close')}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <CardHeader className="text-center pb-4 pt-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <CheckCircle2 className="h-6 w-6 text-atlas-teal" />
            <span className="text-lg font-semibold text-atlas-navy">{t('accessCodeModal.title')}</span>
          </div>
          <p className="text-gray-600">
            {t('accessCodeModal.description')}
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Access code is pre-filled and hidden — no need to show it */}
          <input type="hidden" value={code} />

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
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
                {t('accessCodeModal.starting')}
              </>
            ) : (
              <>
                {t('accessCodeModal.startAssessment')}
                <ArrowRight className="h-5 w-5 ml-2" />
              </>
            )}
          </Button>

          {/* Help Section */}
          <div className="text-center pt-4 border-t">
            <p className="text-xs text-gray-500">
              {t('accessCodeModal.help.prefix')}{' '}
              <button
                onClick={() => setSupportOpen(true)}
                className="text-atlas-blue hover:underline font-medium"
              >
                {t('accessCodeModal.help.contactSupport')}
              </button>
            </p>
          </div>
          <SupportDialog open={supportOpen} onOpenChange={setSupportOpen} />
        </CardContent>
      </Card>
    </div>
  );
};
