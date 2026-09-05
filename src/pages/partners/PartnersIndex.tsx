import React from 'react';
import { useTranslation } from 'react-i18next';
import '../../components/landing/landing.css';
import Seo from '@/components/Seo';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';
import PartnersHero from '@/components/partners/PartnersHero';
import PartnersWhoFor from '@/components/partners/PartnersWhoFor';
import PartnersWhatYouGet from '@/components/partners/PartnersWhatYouGet';
import PartnersCandidateStart from '@/components/partners/PartnersCandidateStart';
import PartnersPricing from '@/components/partners/PartnersPricing';
import PartnersPilot from '@/components/partners/PartnersPilot';
import PartnersFAQ from '@/components/partners/PartnersFAQ';
import PartnersClosing from '@/components/partners/PartnersClosing';

/**
 * /partners — the public marketing page for the partner channel (re-integratie,
 * outplacement, independent career coaches).
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
        <PartnersWhoFor />
        <PartnersWhatYouGet />
        <PartnersCandidateStart />
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
