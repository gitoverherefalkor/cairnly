import React, { useEffect } from 'react';
import '../../components/landing/landing.css';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';
import StarterHero from '@/components/starter/StarterHero';
import LimboSection from '@/components/starter/LimboSection';
import StarterHowItWorks from '@/components/starter/StarterHowItWorks';
import StarterWhatYouGet from '@/components/starter/StarterWhatYouGet';
import StarterPricing from '@/components/starter/StarterPricing';
import StarterFAQ from '@/components/starter/StarterFAQ';
import StarterFinalCTA from '@/components/starter/StarterFinalCTA';

/**
 * Cairnly Starter landing page (/starter) — the Gen Z first/second-job flavor.
 * Assembled from self-contained sections under src/components/starter/,
 * reusing the visual language of the pro landing page (src/components/landing/).
 */
const StarterIndex: React.FC = () => {
  useEffect(() => {
    document.title = 'Cairnly Starter';
  }, []);

  return (
    <div
      className="min-h-screen font-sans overflow-x-clip"
      style={{ background: '#F4ECDA', color: '#122E3B' }}
    >
      <LandingNav variant="page" />
      <main>
        <StarterHero />
        <LimboSection />
        <StarterHowItWorks />
        <StarterWhatYouGet />
        <StarterPricing />
        <StarterFAQ />
        <StarterFinalCTA />
      </main>
      <LandingFooter />
    </div>
  );
};

export default StarterIndex;
