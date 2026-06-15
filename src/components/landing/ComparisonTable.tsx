import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import Reveal from './Reveal';
import { tArray } from '@/lib/i18nArray';

interface Row {
  name: string;
  quiz: string;
  ai: string;
  coach: string;
  cairnlyEmphasis: string;
  cairnlyBody: string;
}

interface MobileOther {
  title: string;
  items: string[];
}

/** Renders **bold** markdown in a translation string as <strong>. Trusted
 *  input (translations we control), so direct JSX output is fine — no XSS
 *  risk. Used by the mobile cards' bullet list. */
const renderBoldMarkdown = (text: string): React.ReactNode => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
};

const ComparisonTable: React.FC = () => {
  const { t } = useTranslation('landing');
  const rows = tArray<Row>(t, 'comparison.rows');
  const cairnlyItems = tArray<string>(t, 'comparison.mobile.cairnlyItems');
  const others = tArray<MobileOther>(t, 'comparison.mobile.others');

  return (
    <section className="bg-[#ECE4D2] py-24 md:py-32">
      <div className="lp-container">
        <Reveal className="max-w-3xl mb-14">
          <div className="lp-eyebrow text-[#1F8282] mb-5">{t('comparison.eyebrow')}</div>
          <h2
            className="font-heading font-bold text-[#122E3B] leading-[1.12]"
            style={{ fontSize: 'clamp(26px, 3vw, 40px)', letterSpacing: '-0.012em' }}
          >
            {t('comparison.titleA')}{' '}
            <br />"<span className="lp-text-teal-grad">{t('comparison.titleQuote')}</span>"
          </h2>
          <p className="mt-6 text-lg text-[#4B6373] font-medium leading-relaxed max-w-2xl">
            {t('comparison.intro')}
          </p>
        </Reveal>

        {/* Desktop table */}
        <Reveal className="hidden lg:block overflow-hidden rounded-2xl border" style={{ borderColor: 'rgba(201,182,144,0.5)' }}>
          <table className="lp-compare-table">
            <thead>
              <tr>
                <th style={{ width: '18%', paddingLeft: 28 }} />
                <th className="lp-compare-cairnly-top" style={{ paddingTop: 20 }}>
                  <span className="text-[#1F8282]">{t('comparison.cols.cairnly')}</span>
                  <span className="block lp-row-name font-medium text-[#6B7F8B]">{t('comparison.cols.cairnlySub')}</span>
                </th>
                <th>
                  {t('comparison.cols.quizTop')}<br />{t('comparison.cols.quizBottom')}{' '}
                  <span className="block lp-row-name font-medium text-[#6B7F8B]">{t('comparison.cols.quizSub')}</span>
                </th>
                <th>
                  {t('comparison.cols.aiTop')}<br />{t('comparison.cols.aiBottom')}{' '}
                  <span className="block lp-row-name font-medium text-[#6B7F8B]">{t('comparison.cols.aiSub')}</span>
                </th>
                <th>
                  {t('comparison.cols.coachTop')}<br />{t('comparison.cols.coachBottom')}{' '}
                  <span className="block lp-row-name font-medium text-[#6B7F8B]">{t('comparison.cols.coachSub')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const cairnlyClass =
                  'lp-compare-cairnly' + (i === rows.length - 1 ? ' lp-compare-cairnly-bottom' : '');
                return (
                  <tr key={row.name}>
                    <td style={{ paddingLeft: 28 }}>
                      <div className="lp-row-name">{row.name}</div>
                    </td>
                    <td className={cairnlyClass}>
                      <p>
                        <strong>{row.cairnlyEmphasis}</strong>{row.cairnlyBody}
                      </p>
                    </td>
                    <td><p>{row.quiz}</p></td>
                    <td><p>{row.ai}</p></td>
                    <td><p>{row.coach}</p></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Reveal>

        {/* Mobile stacked cards */}
        <Reveal className="lg:hidden space-y-4">
          <div className="rounded-2xl p-6" style={{ background: '#FBF6E8', border: '1px solid #D4A024' }}>
            <div
              className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.22em] mb-3"
              style={{ background: '#D4A024', color: '#1A1A1A' }}
            >
              {t('comparison.mobile.cairnlyLabel')}
            </div>
            <ul className="space-y-3 text-[14px] text-[#122E3B] font-medium">
              {cairnlyItems.map((item, i) => (
                <li key={i}>{renderBoldMarkdown(item)}</li>
              ))}
            </ul>
          </div>
          <div className="flex items-center gap-3 pt-4 pb-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6B7F8B]">
              {t('comparison.mobile.othersLabel')}
            </span>
            <span className="h-px flex-1" style={{ background: 'rgba(201,182,144,0.7)' }} />
          </div>
          {others.map((card, ci) => (
            <details
              key={ci}
              className="lp-compare-other rounded-2xl px-6 py-5"
              style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(201,182,144,0.7)' }}
            >
              <summary className="flex items-center justify-between gap-3 cursor-pointer list-none">
                <span className="min-w-0 font-heading font-bold text-[#4B6373]">{card.title}</span>
                <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-[#6B7F8B]">
                  <span className="hidden sm:inline whitespace-nowrap">{t('comparison.mobile.othersHint')}</span>
                  <ChevronDown size={18} className="lp-compare-chev transition-transform" />
                </span>
              </summary>
              <ul className="mt-4 space-y-2 text-[14px] text-[#4B6373] font-medium">
                {card.items.map((it, ii) => <li key={ii}>{it}</li>)}
              </ul>
            </details>
          ))}
        </Reveal>

        <Reveal as="div" className="max-w-3xl mx-auto mt-14">
          <p className="text-center text-base md:text-lg text-[#122E3B] font-bold">
            {t('comparison.closer')}
          </p>
        </Reveal>
      </div>
    </section>
  );
};

export default ComparisonTable;
