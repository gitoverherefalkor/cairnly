import React from 'react';
import { useTranslation } from 'react-i18next';
import '../../components/landing/landing.css';
import Seo from '@/components/Seo';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';
import {
  EmployersAbout,
  EmployersClosing,
  EmployersFAQ,
  EmployersFits,
  EmployersHero,
  EmployersHow,
  EmployersPricing,
  EmployersSplit,
  EmployersTrial,
  EmployersWhy,
} from '@/components/employers/EmployersSections';
import { EMPLOYERS_ROUTE } from '@/components/employers/constants';

/**
 * /employers — Cairnly for employers (draft v1, 2026-09-22 copy).
 *
 * Out of the nav on purpose for now: it is reached from outreach links only.
 * English only; Dutch visitors fall back to the English namespace until
 * nl/employers.json exists.
 *
 * Everything on this page has to survive a screenshot forwarded to a works
 * council, so the "people who don't fit conclude it themselves" angle is NOT
 * on it. That line lives in the outreach, never here.
 */
const EmployersIndex: React.FC = () => {
  const { t } = useTranslation('employers');

  return (
    <div className="min-h-screen font-sans overflow-x-clip" style={{ background: '#ECE4D2', color: '#122E3B' }}>
      <Seo title={t('seo.title')} description={t('seo.description')} path={EMPLOYERS_ROUTE} />
      <LandingNav variant="page" />
      <main>
        <EmployersHero />
        <EmployersWhy />
        <EmployersHow />
        <EmployersSplit />
        <EmployersFits />
        <EmployersPricing />
        <EmployersTrial />
        <EmployersAbout />
        <EmployersFAQ />
        <EmployersClosing />
      </main>
      <LandingFooter />
    </div>
  );
};

export default EmployersIndex;
