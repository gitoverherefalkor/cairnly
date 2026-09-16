import React from 'react';
import './../components/landing/landing.css';
import LandingNav from '@/components/landing/LandingNav';
import Hero from '@/components/landing/Hero';
import NoPurchaseBanner from '@/components/landing/NoPurchaseBanner';
import Pillars from '@/components/landing/Pillars';
import WhoFor from '@/components/landing/WhoFor';
import Methodology from '@/components/landing/Methodology';
import ComparisonTable from '@/components/landing/ComparisonTable';
import Testimonial from '@/components/landing/Testimonial';
import PricingSection from '@/components/landing/PricingSection';
import WhyWeBuiltThis from '@/components/landing/WhyWeBuiltThis';
import FAQ from '@/components/landing/FAQ';
import FinalCTA from '@/components/landing/FinalCTA';
import LandingFooter from '@/components/landing/LandingFooter';
import { IntentProvider } from '@/contexts/IntentContext';
import { IntakeChatProvider } from '@/components/landing/intake/IntakeChatContext';
import { HeroPersonaProvider } from '@/components/landing/demo/HeroPersonaContext';
import Seo from '@/components/Seo';
import { organizationSchema, websiteSchema } from '@/lib/seo';

/**
 * Cairnly homepage (v3) — an editorial, cairn-as-way-marker landing page.
 * Assembled from self-contained sections under src/components/landing/.
 * The hero sells with the public demo (HeroPersonaProvider carries the
 * chosen persona into every demo link on the page).
 *
 * Section order, and why (reordered 2026-09-16):
 *   Hero        the video does the showing
 *   Pillars     what makes this different
 *   WhoFor      qualify BEFORE the ask, not after — this section also holds
 *               the intake chat, which is the objection-handler for people
 *               who are not sure yet. Below the price it never reached them.
 *   Methodology the whole "how does this actually work?" answer in one
 *               section: what it is built on, how it runs, what it rates,
 *               the chat that sharpens it, and the demo CTA
 *   Comparison  the side-by-side, ending on the cost row
 *   Pricing     the ask
 *   WhyWeBuilt  the founder story, which supports the price rather than
 *               trailing behind it
 *   FAQ         last objections
 *   FinalCTA    close
 *
 * Retired (see src/unused/landing/README.md): HowItWorks, which re-told the
 * hero video in static screenshots; CostMath, which repeated the comparison
 * table's closing line 40px below it; and CoachCards, whose content was
 * folded into Methodology on 2026-09-16 so one argument lives in one section.
 */
const Index: React.FC = () => (
  <IntentProvider>
  <IntakeChatProvider>
  <HeroPersonaProvider>
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
      <WhoFor />
      <Methodology />
      <ComparisonTable />
      <Testimonial />
      <PricingSection />
      <WhyWeBuiltThis />
      <FAQ />
      <FinalCTA />
    </main>
    <LandingFooter />
  </div>
  </HeroPersonaProvider>
  </IntakeChatProvider>
  </IntentProvider>
);

export default Index;
