import React, { useEffect } from 'react';
import '../../components/landing/landing.css';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';
import EncoreHero from '@/components/encore/EncoreHero';
import IdentitySection from '@/components/encore/IdentitySection';
import EncoreHowItWorks from '@/components/encore/EncoreHowItWorks';
import EncoreWhatYouGet from '@/components/encore/EncoreWhatYouGet';
import EncorePricing from '@/components/encore/EncorePricing';
import EncoreFAQ from '@/components/encore/EncoreFAQ';
import EncoreFinalCTA from '@/components/encore/EncoreFinalCTA';

/**
 * Cairnly Encore landing page (/encore), the pensioner / pre-retiree flavor.
 * Assembled from self-contained sections under src/components/encore/, reusing
 * the visual language of the pro landing page but rendered a size up for
 * readability (this audience reads glasses-on).
 */
const EncoreIndex: React.FC = () => {
  useEffect(() => {
    document.title = 'Cairnly Encore';
  }, []);

  return (
    <div
      className="min-h-screen font-sans overflow-x-clip"
      style={{ background: '#F4ECDA', color: '#122E3B' }}
    >
      <LandingNav variant="page" />
      <main>
        <EncoreHero />
        <IdentitySection />
        <EncoreHowItWorks />
        <EncoreWhatYouGet />
        <EncorePricing />
        <EncoreFAQ />
        <EncoreFinalCTA />
      </main>
      <LandingFooter />
    </div>
  );
};

export default EncoreIndex;
