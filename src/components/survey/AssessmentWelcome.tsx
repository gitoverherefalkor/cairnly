
import React, { useState, useEffect } from 'react';
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
      setError('Please enter your access code');
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
        setError('Failed to verify access code. Please try again.');
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
      setError('Failed to verify access code. Please try again.');
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
              <strong>Best Experience on Desktop:</strong> For the optimal assessment experience and to fully engage with our career AI coach afterward, we recommend using a computer or tablet rather than a mobile device.
            </AlertDescription>
          </Alert>
        )}

        {/* Welcome Header — cream text: this sits directly on the dark
            teal-navy canvas, so dark `text-atlas-navy` would be illegible. */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-[#F5F5F5] mb-4">
            Welcome to the Cairnly Career Assessment
          </h1>
          {/* Copy is flavor-neutral: this screen renders before the access code
              is verified, so we can't know yet if it's a pro or starter user. */}
          <p className="text-xl text-[#F5F5F5]/80 max-w-lg mx-auto">
            Discover your unique career strengths, values, and ideal work environment through our comprehensive assessment.
          </p>
        </div>

        {/* Main Card */}
        <Card className="w-full">
          <CardHeader className="text-center pb-4">
            <div className="flex items-center justify-center gap-2 mb-4">
              <CheckCircle2 className="h-6 w-6 text-atlas-teal" />
              <span className="text-lg font-semibold text-atlas-navy">Ready to Begin</span>
            </div>
            <p className="text-gray-600">
              Enter your access code below to start your personalized career assessment
            </p>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Access Code Input */}
            <div className="space-y-2">
              <label htmlFor="access-code" className="text-sm font-medium text-gray-700">
                Access Code
              </label>
              <Input
                id="access-code"
                type="text"
                placeholder="XXXX-XXXX-XXXX-XXXX"
                value={code}
                onChange={handleCodeChange}
                onKeyPress={handleKeyPress}
                className="text-center font-mono text-lg tracking-wider py-3"
                maxLength={50}
              />
              <p className="text-xs text-gray-500 text-center">
                Enter the access code you received after your purchase
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
                  Verifying your code...
                </>
              ) : (
                <>
                  Verify Code & Start Assessment
                  <ArrowRight className="h-5 w-5 ml-2" />
                </>
              )}
            </Button>

            {/* Purchase Option */}
            {needsPurchase && (
              <div className="text-center pt-4 border-t">
                <p className="text-sm text-gray-600 mb-3">
                  Don't have a valid access code?
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/')}
                  className="w-full"
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Purchase Access Code
                </Button>
              </div>
            )}

            {/* Help Section */}
            <div className="text-center pt-4 border-t">
              <p className="text-xs text-gray-500">
                Having trouble?{' '}
                <button
                  onClick={() => setSupportOpen(true)}
                  className="text-atlas-blue hover:underline font-medium"
                >
                  Contact support
                </button>{' '}
                or{' '}
                <button
                  onClick={() => navigate('/')}
                  className="text-atlas-blue hover:underline font-medium"
                >
                  return to homepage
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
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-2xl font-bold text-atlas-teal mb-1">⏱️</div>
              <div className="text-sm font-medium text-[#F5F5F5]">15-20 minutes</div>
              <div className="text-xs text-[#F5F5F5]/60">Completion time</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-2xl font-bold text-atlas-teal mb-1">📊</div>
              <div className="text-sm font-medium text-[#F5F5F5]">7 sections</div>
              <div className="text-xs text-[#F5F5F5]/60">Comprehensive analysis</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-2xl font-bold text-atlas-teal mb-1">🎯</div>
              <div className="text-sm font-medium text-[#F5F5F5]">Personalized</div>
              <div className="text-xs text-[#F5F5F5]/60">Custom insights</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
