import React from 'react';
import { useTranslation } from 'react-i18next';
import '../../components/landing/landing.css';
import Seo from '@/components/Seo';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';
import PartnersHero from '@/components/partners/PartnersHero';
import PartnersPreChat from '@/components/partners/prechat/PartnersPreChat';
import PartnersWhoFor from '@/components/partners/PartnersWhoFor';
import PartnersWhatYouGet from '@/components/partners/PartnersWhatYouGet';
import PartnersCandidateStart from '@/components/partners/PartnersCandidateStart';
import PartnersPricing from '@/components/partners/PartnersPricing';
import Testimonial from '@/components/landing/Testimonial';
import PartnersPilot from '@/components/partners/PartnersPilot';
import PartnersFAQ from '@/components/partners/PartnersFAQ';
import PartnersClosing from '@/components/partners/PartnersClosing';

/**
 * /partners — the public marketing page for the partner channel (outplacement,
 * independent career coaches; spoor 2 only for candidates with an office
 * background, per the 2026-10-02 decision to park spoor 2).
 *
 * A plain route inside the existing site, NOT a flavor fork like /starter and
 * /encore: those carry their own pages dir, survey and WF1x-WF4x workflows,
 * which is the wrong shape for a page that just explains the credit model.
 *
 * Language follows the site-wide detector (?lang=nl, a .nl domain, or the
 * saved flag choice) — there are no language path prefixes anywhere on this
 * site. The Dutch link to hand a bureau is /partners?lang=nl.
 */
const PartnersIndex: React.FC = () => {
  const { t } = useTranslation('partners');

  return (
    <div
      className="min-h-screen font-sans overflow-x-clip"
      style={{ background: '#ECE4D2', color: '#122E3B' }}
    >
      <Seo title={t('seo.title')} description={t('seo.description')} path="/partners" />
      <LandingNav variant="page" />
      <main>
        <PartnersHero />
        {/* "Does it belong in my practice?": the demo above shows what it is. */}
        <PartnersPreChat />
        <PartnersWhoFor />
        <PartnersWhatYouGet />
        <PartnersCandidateStart />
        {/* Straight before the price. Full quotes here: this reader knows what
            Career Anchors is, and wants to hear a peer before a candidate. */}
        <Testimonial variant="full" audience="partner" />
        <PartnersPricing />
        <PartnersPilot />
        <PartnersFAQ />
        <PartnersClosing />
      </main>
      <LandingFooter />
    </div>
  );
};

export default PartnersIndex;
