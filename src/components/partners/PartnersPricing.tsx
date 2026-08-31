import React from 'react';
import { useTranslation } from 'react-i18next';
import Reveal from '@/components/landing/Reveal';
import { tArray } from '@/lib/i18nArray';

interface PriceRow {
  credits: string;
  price: string;
}

/**
 * The credit ladder. A plain table rather than the marketing pricing card:
 * a buyer comparing six tiers wants to scan rows, not read a hero panel.
 * Wrapped in an overflow-x container so it never forces the page sideways
 * on a phone.
 */
const PartnersPricing: React.FC = () => {
  const { t } = useTranslation('partners');
  const rows = tArray<PriceRow>(t, 'pricing.rows');

  return (
    <section className="py-20 md:py-28" style={{ background: '#F4ECDA' }}>
      <div className="lp-container">
        <Reveal className="max-w-3xl">
          <h2
            className="font-heading font-bold text-[#122E3B] leading-[1.15] mb-8"
            style={{ fontSize: 'clamp(24px, 2.8vw, 38px)', letterSpacing: '-0.012em' }}
          >
            {t('pricing.title')}
          </h2>
          <p className="text-[15px] md:text-base text-[#4B6373] font-medium leading-[1.7]">
            {t('pricing.intro')}
          </p>
        </Reveal>

        <Reveal className="mt-10 max-w-2xl">
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: '#FBF6E8', border: '1px solid rgba(201, 182, 144, 0.6)' }}
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr style={{ background: 'rgba(39,161,161,0.07)' }}>
                    <th
                      scope="col"
                      className="text-left font-heading font-bold text-[#122E3B] text-[13px] tracking-[0.04em] uppercase px-6 py-4"
                    >
                      {t('pricing.colCredits')}
                    </th>
                    <th
                      scope="col"
                      className="text-right font-heading font-bold text-[#122E3B] text-[13px] tracking-[0.04em] uppercase px-6 py-4 whitespace-nowrap"
                    >
                      {t('pricing.colPrice')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={row.credits}
                      style={{
                        borderTop: i === 0 ? 'none' : '1px solid rgba(201, 182, 144, 0.45)',
                      }}
                    >
                      <td className="px-6 py-4 text-[15px] font-semibold text-[#122E3B] whitespace-nowrap">
                        {row.credits}
                      </td>
                      <td className="px-6 py-4 text-[15px] font-semibold text-[#1F8282] text-right whitespace-nowrap">
                        {row.price}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>

        <Reveal className="mt-7 max-w-2xl">
          <p className="text-[14px] text-[#4B6373] font-medium leading-[1.7]">
            {t('pricing.note')}
          </p>
        </Reveal>
      </div>
    </section>
  );
};

export default PartnersPricing;
