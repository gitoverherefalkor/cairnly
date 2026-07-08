import React from 'react';
import './../components/landing/landing.css';
import LandingNav from '@/components/landing/LandingNav';
import Hero from '@/components/landing/Hero';
import NoPurchaseBanner from '@/components/landing/NoPurchaseBanner';
import Pillars from '@/components/landing/Pillars';
import HowItWorks from '@/components/landing/HowItWorks';
import Methodology from '@/components/landing/Methodology';
import CoachCards from '@/components/landing/CoachCards';
import ComparisonTable from '@/components/landing/ComparisonTable';
import CostMath from '@/components/landing/CostMath';
import PricingSection from '@/components/landing/PricingSection';
import WhoFor from '@/components/landing/WhoFor';
import WhyWeBuiltThis from '@/components/landing/WhyWeBuiltThis';
import FAQ from '@/components/landing/FAQ';
import FinalCTA from '@/components/landing/FinalCTA';
import LandingFooter from '@/components/landing/LandingFooter';
import { IntentProvider } from '@/contexts/IntentContext';
import Seo from '@/components/Seo';
import { organizationSchema, websiteSchema } from '@/lib/seo';

/**
 * Cairnly homepage (v2) — an editorial, cairn-as-way-marker landing page.
 * Assembled from self-contained sections under src/components/landing/.
 */
const Index: React.FC = () => (
  <IntentProvider>
  <Seo path="/" jsonLd={[organizationSchema, websiteSchema]} />
  <div
    className="min-h-screen font-sans overflow-x-clip"
    style={{ background: '#F4ECDA', color: '#122E3B' }}
  >
    <NoPurchaseBanner />
    <LandingNav variant="home" />
    <main>
      <Hero />
      <Pillars />
      <HowItWorks />
      <Methodology />
      <CoachCards />
      <ComparisonTable />
      <CostMath />
      <PricingSection />
      <WhoFor />
      {/* ForkDivider hidden — the same-path/different-path diagram wasn't landing well */}
      <WhyWeBuiltThis />
      <FAQ />
      <FinalCTA />
    </main>
    <LandingFooter />
  </div>
  </IntentProvider>
);

export default Index;
