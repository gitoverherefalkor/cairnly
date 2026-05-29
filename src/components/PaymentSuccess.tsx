import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, ArrowLeft, ArrowRight, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { clearStoredReferralCode } from '@/lib/referral';
import AuthShell from '@/components/auth/AuthShell';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const [accessCode, setAccessCode] = useState<string | null>(null);
  const [purchaseData, setPurchaseData] = useState<{
    email?: string;
    firstName?: string;
    lastName?: string;
  }>({});
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  // Did THIS device/browser start the checkout? CheckoutForm sets this flag
  // right before the Stripe redirect. If it's missing, the buyer almost
  // certainly paid on a different device (e.g. confirmed in their phone bank
  // app after starting on a computer), so we point them back rather than
  // pushing the signup flow here.
  const [initiatedHere] = useState(() => localStorage.getItem('checkout_initiated_here') === '1');

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    const isDemo = searchParams.get('demo') === 'true';

    // Handle demo mode
    if (isDemo) {
      setIsProcessing(false);
      setIsComplete(true);
      setAccessCode('CAIRNLY-DEMO12345');
      toast({
        title: 'Demo Purchase Successful!',
        description: 'This is a demo purchase with a sample access code.',
      });
      return;
    }

    if (!sessionId) {
      navigate('/');
      return;
    }

    const processPayment = async () => {
      try {
        setIsProcessing(true);

        const { data, error } = await supabase.functions.invoke('payment-success', {
          body: { sessionId },
        });

        if (error) {
          throw new Error(error.message);
        }

        if (data?.accessCode) {
          setAccessCode(data.accessCode);
        }

        // Store purchase data for pre-filling the auth form and access code recovery
        // (persists across OAuth redirects and page navigations)
        if (data?.purchaseData) {
          setPurchaseData(data.purchaseData);
          localStorage.setItem(
            'purchase_data',
            JSON.stringify({
              email: data.purchaseData.email,
              firstName: data.purchaseData.firstName,
              lastName: data.purchaseData.lastName,
              accessCode: data.accessCode,
            })
          );
        }

        // A referral code (if any) has now been spent on this purchase —
        // clear it so it can't apply to a later unrelated checkout.
        clearStoredReferralCode();

        setIsComplete(true);
        toast({
          title: 'Purchase Successful!',
          description: 'Check your email for your access code.',
        });
      } catch (error) {
        console.error('Payment processing error:', error);
        toast({
          title: 'Payment Processing Error',
          description: error instanceof Error ? error.message : 'An unexpected error occurred',
          variant: 'destructive',
        });

        // Redirect to home after error
        setTimeout(() => navigate('/'), 5000);
      } finally {
        setIsProcessing(false);
      }
    };

    processPayment();
  }, [searchParams, navigate, toast]);

  const handleStartAssessment = () => {
    if (!user) {
      // Build URL with access code and purchase data for pre-filling
      const params = new URLSearchParams({
        code: accessCode || '',
        flow: 'signup',
      });

      // Add purchase data if available
      if (purchaseData.email) params.append('email', purchaseData.email);
      if (purchaseData.firstName) params.append('firstName', purchaseData.firstName);
      if (purchaseData.lastName) params.append('lastName', purchaseData.lastName);

      navigate(`/auth?${params.toString()}`);
    } else {
      // User is authenticated - go directly to assessment with access code
      navigate(`/assessment?code=${accessCode}`);
    }
  };

  const primaryBtnCls =
    'w-full rounded-full bg-atlas-teal text-white hover:bg-atlas-teal/90 font-bold text-[14.5px] py-[13px] shadow-[0_10px_24px_-8px_rgba(39,161,161,0.55)]';
  const ghostBtnCls = 'w-full rounded-full border bg-transparent font-bold';
  const ghostBtnStyle = { color: '#1F8282', borderColor: 'rgba(31,130,130,0.32)' };

  // --- Loading state ---
  if (isProcessing) {
    return (
      <AuthShell eyebrow="One moment" title="Processing Payment...">
        <div className="flex justify-center mb-4">
          <div
            className="h-[72px] w-[72px] rounded-full flex items-center justify-center border"
            style={{
              background: 'rgba(39,161,161,0.10)',
              borderColor: 'rgba(39,161,161,0.30)',
            }}
          >
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#1F8282' }} />
          </div>
        </div>
        <p
          className="text-center text-[15px] font-medium mx-auto"
          style={{ color: '#1F2937', lineHeight: 1.5, maxWidth: 360 }}
        >
          Please wait while we confirm your payment and generate your access code.
        </p>
      </AuthShell>
    );
  }

  // --- Error state ---
  if (!isComplete) {
    return (
      <AuthShell eyebrow="Payment error" title="Something went wrong">
        <div className="flex justify-center mb-4">
          <div
            className="h-[72px] w-[72px] rounded-full flex items-center justify-center border"
            style={{
              background: 'rgba(220,38,38,0.10)',
              borderColor: 'rgba(220,38,38,0.28)',
            }}
          >
            <XCircle className="h-8 w-8" style={{ color: '#DC2626' }} />
          </div>
        </div>
        <p
          className="text-center text-[15px] font-medium mx-auto mb-6"
          style={{ color: '#1F2937', lineHeight: 1.5, maxWidth: 380 }}
        >
          We were unable to process your payment. You will be redirected back to the homepage shortly.
        </p>
        <Button onClick={() => navigate('/')} className={primaryBtnCls}>
          Return to Home Now
        </Button>
      </AuthShell>
    );
  }

  // Reusable access-code panel, shown in both success variants.
  const accessCodeBlock = accessCode ? (
    <div className="mb-5">
      <span
        className="block text-center font-heading uppercase text-[11px] mb-2.5"
        style={{ color: '#C8891A', letterSpacing: '0.24em', fontWeight: 700 }}
      >
        Your Access Code
      </span>
      <div
        className="text-center rounded-xl"
        style={{
          background: '#F5EFE2',
          border: '1px dashed rgba(201, 182, 144, 0.9)',
          padding: '10px 16px',
        }}
      >
        <p
          className="m-0"
          style={{
            fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace",
            fontSize: 16,
            fontWeight: 700,
            color: '#122E3B',
            letterSpacing: '0.14em',
            lineHeight: 1.1,
          }}
        >
          {accessCode}
        </p>
      </div>
      <p
        className="text-[12px] font-medium text-center mt-2.5"
        style={{ color: '#6B7F8B' }}
      >
        {searchParams.get('demo') === 'true'
          ? 'This is a demo access code for testing purposes only.'
          : 'This code will be automatically pre-filled and verified later, but as a backup it is also sent to your email.'}
      </p>
    </div>
  ) : null;

  // --- Success state on a device that did NOT start this checkout ---
  // Most commonly: the buyer started on their computer and confirmed payment in
  // their phone bank app, so Stripe redirected the phone here. Pushing the
  // "Create Account" flow on the phone is confusing, so we point them back to
  // the device they started on. A secondary option still lets them continue
  // here if they really want to.
  if (!initiatedHere && searchParams.get('demo') !== 'true') {
    return (
      <AuthShell eyebrow="Payment successful" title="Thank you for your purchase!" width="wide">
        <div className="flex justify-center mb-5">
          <div
            className="h-[72px] w-[72px] rounded-full flex items-center justify-center border"
            style={{ background: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.32)' }}
          >
            <CheckCircle className="h-8 w-8" style={{ color: '#16A34A' }} />
          </div>
        </div>

        {accessCodeBlock}

        <p
          className="text-center text-[15px] font-medium mx-auto mb-2"
          style={{ color: '#1F2937', lineHeight: 1.5, maxWidth: 380 }}
        >
          Your payment went through. To continue, head back to the device where
          you started. Your assessment is ready and waiting for you there.
        </p>
        <p
          className="text-center text-[13px] font-medium mx-auto mb-5"
          style={{ color: '#6B7F8B', maxWidth: 380 }}
        >
          We also emailed your access code as a backup.
        </p>

        <div className="space-y-2.5">
          <Button
            variant="outline"
            onClick={handleStartAssessment}
            className={ghostBtnCls}
            style={ghostBtnStyle}
          >
            Continue on this device instead
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/')}
            className={ghostBtnCls}
            style={ghostBtnStyle}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Return to Home
          </Button>
        </div>
      </AuthShell>
    );
  }

  // --- Success state ---
  return (
    <AuthShell
      eyebrow="Payment successful"
      title="Thank you for your purchase!"
      width="wide"
    >
      <div className="flex justify-center mb-5">
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

      {accessCodeBlock}

      <div className="space-y-2.5">
        {!user && (
          <p
            className="text-[14px] font-medium text-center mb-1"
            style={{ color: '#1F2937', lineHeight: 1.5 }}
          >
            To start your assessment, you'll need to create an account first.
          </p>
        )}
        <Button onClick={handleStartAssessment} size="lg" className={primaryBtnCls}>
          {!user ? (
            <>
              Create Account
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          ) : (
            <>
              Start Assessment Now
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>

        <Button
          variant="outline"
          onClick={() => navigate('/')}
          className={ghostBtnCls}
          style={ghostBtnStyle}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Return to Home
        </Button>
      </div>
    </AuthShell>
  );
};

export default PaymentSuccess;
