import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import '../components/landing/landing.css';
import { Check, ArrowRight } from 'lucide-react';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';
import { supabase } from '@/integrations/supabase/client';

const NewsletterUnsubscribe: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Always fire-and-forget; the endpoint never reveals token state.
      await supabase.functions.invoke('journal-unsubscribe', { body: { token } });
      if (!cancelled) setDone(true);
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
            You've been unsubscribed.
          </h1>
          <p className="text-white/65 text-lg">
            {done ? 'No more Journal emails from us.' : 'Saving your preference…'}
          </p>
          <div className="mt-10">
            <Link to="/journal" className="lp-btn-primary" style={{ fontSize: 15 }}>
              Back to the Journal
              <ArrowRight size={16} strokeWidth={2.4} />
            </Link>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
};

export default NewsletterUnsubscribe;
