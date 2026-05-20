import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import '../components/landing/landing.css';
import { Check, AlertTriangle, Loader2, ArrowRight } from 'lucide-react';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';
import { supabase } from '@/integrations/supabase/client';

type State =
  | { kind: 'loading' }
  | { kind: 'success'; email?: string }
  | { kind: 'failed' };

const NewsletterConfirm: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setState({ kind: 'failed' });
      return;
    }
    (async () => {
      const { data, error } = await supabase.functions.invoke('journal-confirm', {
        body: { token },
      });
      if (cancelled) return;
      if (!error && (data as { ok?: boolean })?.ok) {
        setState({ kind: 'success', email: (data as { email?: string }).email });
      } else {
        setState({ kind: 'failed' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div
      className="min-h-screen font-sans overflow-x-clip"
      style={{ background: '#F4ECDA', color: '#122E3B' }}
    >
      <LandingNav variant="page" />

      <section className="bg-[#213F4F] text-white py-24 md:py-32 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-[700px] h-[700px] rounded-full pointer-events-none"
          style={{
            background: 'rgba(39,161,161,0.12)',
            filter: 'blur(120px)',
            marginRight: -300,
            marginTop: -200,
          }}
        />
        <div className="lp-container relative z-10 max-w-2xl mx-auto text-center">
          {state.kind === 'loading' && (
            <>
              <div
                className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-6"
                style={{ background: 'rgba(255,255,255,0.08)' }}
              >
                <Loader2 size={26} strokeWidth={2.2} className="animate-spin" color="#fff" />
              </div>
              <h1
                className="font-heading font-bold leading-[1.1] mb-4"
                style={{ fontSize: 'clamp(26px, 3.4vw, 38px)', letterSpacing: '-0.015em' }}
              >
                Confirming…
              </h1>
              <p className="text-white/65 text-lg">One moment.</p>
            </>
          )}

          {state.kind === 'success' && (
            <>
              <div
                className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-6"
                style={{
                  background: 'linear-gradient(135deg, #27A1A1, #3989AF)',
                  boxShadow: '0 12px 30px -10px rgba(39,161,161,0.55)',
                }}
              >
                <Check size={26} strokeWidth={2.6} color="#fff" />
              </div>
              <h1
                className="font-heading font-bold leading-[1.1] mb-4"
                style={{ fontSize: 'clamp(26px, 3.4vw, 38px)', letterSpacing: '-0.015em' }}
              >
                You're subscribed.
              </h1>
              <p className="text-white/70 text-lg mb-2">
                We'll only email when there's something worth reading.
              </p>
              {state.email && (
                <p className="text-white/40 text-sm">Confirmed for {state.email}</p>
              )}
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/journal" className="lp-btn-primary" style={{ fontSize: 15 }}>
                  Back to the Journal
                  <ArrowRight size={16} strokeWidth={2.4} />
                </Link>
              </div>
            </>
          )}

          {state.kind === 'failed' && (
            <>
              <div
                className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-6"
                style={{ background: 'rgba(212,160,36,0.15)', border: '1px solid rgba(212,160,36,0.4)' }}
              >
                <AlertTriangle size={26} strokeWidth={2.2} color="#D4A024" />
              </div>
              <h1
                className="font-heading font-bold leading-[1.1] mb-4"
                style={{ fontSize: 'clamp(26px, 3.4vw, 38px)', letterSpacing: '-0.015em' }}
              >
                This link has expired or already been used.
              </h1>
              <p className="text-white/65 text-lg mb-8">
                You can sign up again from the Journal page. If you've already confirmed, you're
                all set.
              </p>
              <Link to="/journal" className="lp-btn-primary" style={{ fontSize: 15 }}>
                Back to the Journal
                <ArrowRight size={16} strokeWidth={2.4} />
              </Link>
            </>
          )}
        </div>
      </section>

      <LandingFooter />
    </div>
  );
};

export default NewsletterConfirm;
