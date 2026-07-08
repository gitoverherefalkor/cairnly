import React from 'react';
import '../../components/landing/landing.css';
import Seo from '@/components/Seo';
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
  return (
    <div
      className="min-h-screen font-sans overflow-x-clip"
      style={{ background: '#F4ECDA', color: '#122E3B' }}
    >
      <Seo
        title="Cairnly Starter — Figure out your first career move"
        description="Just starting out and unsure what to do? Cairnly Starter turns who you are into concrete first- and second-job directions, built with career coaches."
        path="/starter"
      />
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
