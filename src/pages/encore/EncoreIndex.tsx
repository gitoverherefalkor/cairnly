import React from 'react';
import '../../components/landing/landing.css';
import Seo from '@/components/Seo';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';
import EncoreHero from '@/components/encore/EncoreHero';
import IdentitySection from '@/components/encore/IdentitySection';
import EncoreHowItWorks from '@/components/encore/EncoreHowItWorks';
import EncoreWhatYouGet from '@/components/encore/EncoreWhatYouGet';
import EncoreFacts from '@/components/encore/EncoreFacts';
import EncoreReportPreview from '@/components/encore/EncoreReportPreview';
import CairnRail from '@/components/landing/CairnRail';
import EncorePricing from '@/components/encore/EncorePricing';
import EncoreFAQ from '@/components/encore/EncoreFAQ';
import EncoreFinalCTA from '@/components/encore/EncoreFinalCTA';
import { useFormalDutch } from '@/hooks/useFormalDutch';
import { useTranslation } from 'react-i18next';

/**
 * Cairnly Encore landing page (/encore), the pensioner / pre-retiree flavor.
 * Assembled from self-contained sections under src/components/encore/, reusing
 * the visual language of the pro landing page but rendered a size up for
 * readability (this audience reads glasses-on).
 */
/** Sections the cairn counts: five stones, then the capstone on pricing. */
const ENCORE_RAIL_SECTIONS = ['identity', 'facts', 'how-it-works', 'what-you-get', 'report-preview', 'pricing'];

const EncoreIndex: React.FC = () => {
  // Visitors who start here get Encore's formal Dutch ("u") on signup too.
  useFormalDutch(true);
  const { t, i18n } = useTranslation('encore');
  // Dutch lives at /encore?lang=nl (language comes from ?lang, see i18n.ts),
  // so each language version is its own canonical URL, linked via hreflang.
  const isDutch = (i18n.resolvedLanguage || i18n.language || 'en').startsWith('nl');
  return (
    <div
      className="min-h-screen font-sans overflow-x-clip"
      style={{ background: '#F4ECDA', color: '#122E3B' }}
    >
      <Seo
        title={t('seo.title')}
        description={t('seo.description')}
        path={isDutch ? '/encore?lang=nl' : '/encore'}
        lang={isDutch ? 'nl' : 'en'}
        alternates={[
          { hreflang: 'en', path: '/encore' },
          { hreflang: 'nl', path: '/encore?lang=nl' },
          { hreflang: 'x-default', path: '/encore' },
        ]}
      />
      <LandingNav variant="page" />
      {/* Scroll-built cairn, wide screens only (see CairnRail). */}
      <CairnRail sectionIds={ENCORE_RAIL_SECTIONS} />
      <main>
        <EncoreHero />
        <IdentitySection />
        <EncoreFacts />
        <EncoreHowItWorks />
        <EncoreWhatYouGet />
        <EncoreReportPreview />
        <EncorePricing />
        <EncoreFAQ />
        <EncoreFinalCTA />
      </main>
      <LandingFooter />
    </div>
  );
};

export default EncoreIndex;
