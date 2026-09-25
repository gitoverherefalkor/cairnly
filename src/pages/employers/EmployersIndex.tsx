import React from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import '../../components/landing/landing.css';
import Seo from '@/components/Seo';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';
import {
  EmployersAbout,
  EmployersClosing,
  EmployersCouncil,
  EmployersEmployeeSees,
  EmployersFAQ,
  EmployersFits,
  EmployersGet,
  EmployersHero,
  EmployersHow,
  EmployersPricing,
  EmployersTrial,
  EmployersWhy,
} from '@/components/employers/EmployersSections';
import { EMPLOYERS_ROUTE, SHOW_EMPLOYEE_SCREEN_QUOTE } from '@/components/employers/constants';
import englishI18n from '@/components/employers/englishI18n';

/**
 * /employers — Cairnly for employers (copy v2, 2026-09-25). Stats are
 * sourced in cairnly-employers-stats-and-article-base.md.
 *
 * Out of the nav on purpose for now: it is reached from outreach links only.
 * English only, INCLUDING the nav, trust bar and footer: the page renders
 * inside its own English i18next instance (see englishI18n.ts) until
 * nl/employers.json exists.
 *
 * Everything on this page has to survive a screenshot forwarded to a works
 * council, so the "people who don't fit conclude it themselves" angle is NOT
 * on it. That line lives in the outreach, never here.
 */
const EmployersPage: React.FC = () => {
  const { t } = useTranslation('employers');

  return (
    <div className="min-h-screen font-sans overflow-x-clip" style={{ background: '#ECE4D2', color: '#122E3B' }}>
      <Seo title={t('seo.title')} description={t('seo.description')} path={EMPLOYERS_ROUTE} />
      <LandingNav variant="page" />
      <main>
        <EmployersHero />
        <EmployersWhy />
        <EmployersFits />
        <EmployersHow />
        {SHOW_EMPLOYEE_SCREEN_QUOTE && <EmployersEmployeeSees />}
        <EmployersCouncil />
        <EmployersGet />
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

const EmployersIndex: React.FC = () => (
  <I18nextProvider i18n={englishI18n}>
    <EmployersPage />
  </I18nextProvider>
);

export default EmployersIndex;
