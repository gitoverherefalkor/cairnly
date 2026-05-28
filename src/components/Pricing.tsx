import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { CheckCircle, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getCurrentPricing } from '@/lib/pricing';
import { formatCurrency } from '@/lib/format';

const Pricing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, i18n } = useTranslation('landing');

  const pricing = getCurrentPricing();
  const featureKeys = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9'] as const;

  const handleGetBetaAccess = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/payment');
    }
  };

  return <section id="pricing" className="section bg-gray-50">
      <div className="container-atlas">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('pricing.headline')}</h2>
          <div className="w-20 h-1 bg-gradient-to-r from-atlas-blue to-atlas-indigo mx-auto mb-6"></div>
          <p className="text-lg text-gray-700 max-w-3xl mx-auto">
            {t('pricing.intro')}
          </p>
        </div>

        <div className="max-w-xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-atlas-blue to-atlas-indigo p-6 text-white text-center">
              <div className="inline-flex items-center gap-2 bg-white/20 rounded-full py-1 px-3 mb-4">
                <Star className="h-4 w-4" fill="currentColor" />
                <span className="font-medium">{t('pricing.betaAccess')}</span>
              </div>
              <h3 className="text-2xl font-bold mb-2">{t('pricing.productName')}</h3>
              <div className="flex items-baseline justify-center">
                <span className="text-4xl font-bold">{formatCurrency(pricing.core, i18n.language)}</span>
                <span className="text-lg ml-2 opacity-80"><s>{formatCurrency(pricing.original, i18n.language)}</s></span>
              </div>
              <p className="mt-2 opacity-80">{t('pricing.limitedTimeNote')}</p>
            </div>

            <div className="p-8">
              <ul className="space-y-4 mb-8">
                {featureKeys.map((key) => (
                  <li key={key} className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
                    <span>{t(`pricing.features.${key}`)}</span>
                  </li>
                ))}
              </ul>

              <Button onClick={handleGetBetaAccess} className="w-full btn-primary text-lg py-6">
                {t('pricing.ctaButton')}
              </Button>

              <p className="text-sm text-gray-500 mt-4 text-center">
                {t('pricing.footerNote')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>;
};

export default Pricing;
