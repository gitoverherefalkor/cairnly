// Jobs · Search — pre-results state. Career picker + location filters + the
// big gold "Search N careers" CTA. Replaces the prod CareerSelector +
// LocationInput components' UI; their data exports (COUNTRIES,
// profileCountryToCode) are still used.

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Ban, CheckCircle2, Clock, Globe, Heart, Loader2, Search, SlidersHorizontal } from 'lucide-react';
import {
  PALETTE,
  FONT_DISPLAY,
  FONT_BODY,
  LakeBackground,
} from '@/components/dashboard/v2/dashboardV2Shared';
import { DashboardAppNav } from '@/components/dashboard/v2/DashboardAppNav';
import { CareerTierBadge, JEyebrow, type JobsTier } from './jobsV2Shared';
import type { WorkArrangement, JobCommitment } from '@/hooks/useJobSearch';
import { useIsMobile } from '@/hooks/use-mobile';

// A previously-run search the user can replay in one click. Lives in
// localStorage on the page side; the type is declared here so both Jobs.tsx
// (owner) and JobsSearch (consumer) share a single shape.
export interface RecentSearch {
  selectedCareers: string[];
  primaryCountry: string;
  secondaryCountry: string;
  city: string;
  workArrangement: WorkArrangement;
  jobCommitment: JobCommitment;
  ranAt: number;
}

export interface JobsSearchCareerOption {
  sectionType: string;
  title: string;
  tier: JobsTier;
  shape?: string | null;
  // 25-40 word plain-English "what the role actually is" blurb extracted from
  // the report section's Overview heading. Plumbed through to n8n so the
  // keyword generator + scorer have concrete context for niche careers, not
  // just the title alone.
  overview?: string | null;
}

export interface JobsSearchCountry {
  code: string;
  label: string;
}

// Labels resolve through t() at render time (search.location.* /
// search.commitment.*), so the option value is the only constant here.
const WORK_OPTIONS: WorkArrangement[] = ['any', 'remote_friendly', 'remote_only'];
const COMMITMENT_OPTIONS: JobCommitment[] = ['any', 'full_time', 'part_time', 'contract'];

// Collapsible panel showing the "avoid" preferences pulled from the user's
// assessment. Each item is a toggle — unchecking it means "don't filter this
// out for this search" (people forget what they marked to avoid months ago).
interface JobsSearchProps {
  firstName: string;
  careers: JobsSearchCareerOption[];
  selected: string[];
  onToggleSelected: (sectionType: string) => void;
  countries: JobsSearchCountry[];
  primaryCountry: string;
  onPrimaryCountryChange: (code: string) => void;
  secondaryCountry: string;
  onSecondaryCountryChange: (code: string) => void;
  city: string;
  onCityChange: (city: string) => void;
  workArrangement: WorkArrangement;
  onWorkArrangementChange: (v: WorkArrangement) => void;
  jobCommitment: JobCommitment;
  onJobCommitmentChange: (v: JobCommitment) => void;
  avoidPreferences: string[];
  disabledAvoids: string[];
  onToggleAvoid: (item: string) => void;
  isSearching: boolean;
  onSearch: () => void;
  onBack: () => void;
  onProfile: () => void;
  onSignOut: () => void;
  // Optional saved-jobs CTA in the top-right when the user has a pipeline.
  savedCount: number;
  onOpenSaved: () => void;
  // Previous searches (most recent first), rendered as a chip-list under the
  // Search button. Clicking a chip restores the inputs; the user re-clicks
  // Search to actually run it (and hits the backend cache for free).
  recentSearches: RecentSearch[];
  onApplyRecentSearch: (s: RecentSearch) => void;
  // Resolves a country code to its display label, for the chip text.
  countryLabelByCode: (code: string) => string;
}

export const JobsSearch: React.FC<JobsSearchProps> = ({
  firstName,
  careers,
  selected,
  onToggleSelected,
  countries,
  primaryCountry,
  onPrimaryCountryChange,
  secondaryCountry,
  onSecondaryCountryChange,
  city,
  onCityChange,
  workArrangement,
  onWorkArrangementChange,
  jobCommitment,
  onJobCommitmentChange,
  avoidPreferences,
  disabledAvoids,
  onToggleAvoid,
  isSearching,
  onSearch,
  onBack,
  onProfile,
  onSignOut,
  savedCount,
  onOpenSaved,
  recentSearches,
  onApplyRecentSearch,
  countryLabelByCode,
}) => {
  // Phones get one column everywhere; the desktop grids are unchanged.
  const mobile = useIsMobile();
  const { t } = useTranslation('jobs');
  return (
  <LakeBackground intensity="normal">
    <DashboardAppNav
      firstName={firstName}
      pageLabel={t('nav.findRoles')}
      onProfile={onProfile}
      onSignOut={onSignOut}
      onBack={onBack}
      backLabel={t('nav.backToDashboard')}
    />

    <div style={{ maxWidth: 1280, margin: '0 auto', padding: mobile ? '28px 16px 64px' : '48px 32px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 36, gap: 24, flexWrap: 'wrap' }}>
        <div>
          <JEyebrow>{t('search.eyebrow')}</JEyebrow>
          <h1
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: mobile ? 34 : 48,
              letterSpacing: '-0.03em',
              color: '#fff',
              margin: '12px 0 8px 0',
              lineHeight: 1.0,
            }}
          >
            {t('search.title')}
          </h1>
          <p
            style={{
              fontFamily: FONT_BODY,
              fontSize: 16,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.72)',
              lineHeight: 1.5,
              margin: 0,
              maxWidth: 620,
            }}
          >
            Pick up to 3 careers from your report, set where you'd work, then run the search. Results are
            ranked by an AI score against your profile.
          </p>
        </div>
        {savedCount > 0 && (
          <button
            type="button"
            onClick={onOpenSaved}
            style={{
              background: PALETTE.gold,
              color: PALETTE.canvasDeep,
              border: 'none',
              padding: '14px 22px',
              borderRadius: 9999,
              fontFamily: FONT_BODY,
              fontWeight: 700,
              fontSize: 14,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
              boxShadow: '0 12px 28px -10px rgba(212,160,36,0.55)',
              whiteSpace: 'nowrap',
            }}
          >
            <Heart size={15} fill={PALETTE.canvasDeep} />
            {t('search.savedRoles', { count: savedCount })}
          </button>
        )}
      </div>

      {/* Career picker */}
      <section style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
          <JEyebrow>{t('search.careersEyebrow')}</JEyebrow>
          <span style={{ fontFamily: FONT_BODY, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}>
            {selected.length} / 3 selected
          </span>
        </div>
        {careers.length === 0 ? (
          <div
            style={{
              padding: 32,
              background: 'rgba(18,46,59,0.55)',
              border: '1px dashed rgba(255,255,255,0.12)',
              borderRadius: 18,
              textAlign: 'center',
              fontFamily: FONT_BODY,
              fontSize: 14,
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            {t('search.noCareers')}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(3, 1fr)', gap: 14 }}>
            {careers.map((c) => (
              <CareerPickerCard
                key={c.sectionType}
                career={c}
                selected={selected.includes(c.sectionType)}
                disabled={!selected.includes(c.sectionType) && selected.length >= 3}
                onToggle={() => onToggleSelected(c.sectionType)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Location + avoid panel (single card, two columns split by a thin divider) */}
      <section style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 14, gap: 8 }}>
          <JEyebrow>{t('search.whereEyebrow')}</JEyebrow>
        </div>
        <div
          style={{
            background: 'rgba(18, 46, 59, 0.55)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 18,
            padding: 20,
            display: 'grid',
            gridTemplateColumns: avoidPreferences.length > 0 && !mobile ? 'minmax(0, 1.55fr) minmax(0, 1fr)' : '1fr',
            gap: mobile ? 20 : 0,
          }}
        >
          {/* LEFT: Country/Work-arrangement/Hours */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              paddingRight: avoidPreferences.length > 0 && !mobile ? 24 : 0,
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr 1fr', gap: 12, alignItems: 'end' }}>
              <FormField label={t('search.country')}>
                <CreamSelect value={primaryCountry} onChange={onPrimaryCountryChange} options={countries} />
              </FormField>
              <FormField label={t('search.secondCountry')}>
                <CreamSelect
                  value={secondaryCountry}
                  onChange={onSecondaryCountryChange}
                  options={[{ code: '', label: t('search.none') }, ...countries.filter((c) => c.code !== primaryCountry)]}
                />
              </FormField>
              <FormField label={t('search.city')}>
                <CreamInput value={city} onChange={onCityChange} placeholder={t('search.cityPlaceholder')} />
              </FormField>
            </div>

            <div>
              <div
                style={{
                  fontFamily: FONT_BODY,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.5)',
                  marginBottom: 8,
                }}
              >
                {t('search.arrangement')}
              </div>
              <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 8 }}>
                {WORK_OPTIONS.map((opt) => {
                  const active = workArrangement === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => onWorkArrangementChange(opt)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        cursor: 'pointer',
                        padding: '10px 16px',
                        borderRadius: 9999,
                        border: `1px solid ${active ? PALETTE.gold : 'rgba(255,255,255,0.16)'}`,
                        background: active ? 'rgba(212,160,36,0.14)' : 'transparent',
                        fontFamily: FONT_BODY,
                        fontWeight: 700,
                        fontSize: 13,
                        color: active ? PALETTE.goldBright : '#fff',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {opt !== 'any' && <Globe size={14} />}
                      {t(`search.location.${opt}`)}
                    </button>
                  );
                })}
              </div>
              <p
                style={{
                  fontFamily: FONT_BODY,
                  fontSize: 12.5,
                  fontWeight: 500,
                  lineHeight: 1.5,
                  color: 'rgba(255,255,255,0.55)',
                  margin: '12px 0 0 0',
                  maxWidth: 640,
                }}
              >
                {t('search.arrangementNote')} <em>{t('search.arrangementNoteEmphasis')}</em>.{' '}
                {t('search.arrangementNoteTail')}
              </p>
            </div>

            <div>
              <div
                style={{
                  fontFamily: FONT_BODY,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.5)',
                  marginBottom: 8,
                }}
              >
                {t('search.hours')}
              </div>
              <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 8 }}>
                {COMMITMENT_OPTIONS.map((opt) => {
                  const active = jobCommitment === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => onJobCommitmentChange(opt)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        cursor: 'pointer',
                        padding: '10px 16px',
                        borderRadius: 9999,
                        border: `1px solid ${active ? PALETTE.gold : 'rgba(255,255,255,0.16)'}`,
                        background: active ? 'rgba(212,160,36,0.14)' : 'transparent',
                        fontFamily: FONT_BODY,
                        fontWeight: 700,
                        fontSize: 13,
                        color: active ? PALETTE.goldBright : '#fff',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {opt !== 'any' && <Clock size={14} />}
                      {t(`search.commitment.${opt}`)}
                    </button>
                  );
                })}
              </div>
              <p
                style={{
                  fontFamily: FONT_BODY,
                  fontSize: 12.5,
                  fontWeight: 500,
                  lineHeight: 1.5,
                  color: 'rgba(255,255,255,0.55)',
                  margin: '12px 0 0 0',
                  maxWidth: 640,
                }}
              >
                {t('search.hoursNote')}
              </p>
            </div>
          </div>

          {/* RIGHT: Avoid panel (always visible, vertical divider on the left) */}
          {avoidPreferences.length > 0 && (
            <div
              style={{
                borderLeft: mobile ? 'none' : '1px solid rgba(255, 255, 255, 0.10)',
                borderTop: mobile ? '1px solid rgba(255, 255, 255, 0.10)' : 'none',
                paddingLeft: mobile ? 0 : 24,
                paddingTop: mobile ? 20 : 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <SlidersHorizontal size={15} color={PALETTE.goldBright} />
                <span style={{ fontFamily: FONT_BODY, fontSize: 13.5, fontWeight: 700, color: '#fff' }}>
                  {t('search.avoidTitle')}
                </span>
                <span style={{ fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 500, color: 'rgba(255,255,255,0.55)' }}>
                  {t('search.avoidActive', {
                    active:
                      avoidPreferences.length -
                      disabledAvoids.filter((d) => avoidPreferences.includes(d)).length,
                    total: avoidPreferences.length,
                  })}
                </span>
              </div>
              <p
                style={{
                  fontFamily: FONT_BODY,
                  fontSize: 12.5,
                  fontWeight: 500,
                  lineHeight: 1.5,
                  color: 'rgba(255,255,255,0.55)',
                  margin: 0,
                }}
              >
                {t('search.avoidNote')}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {avoidPreferences.map((item) => {
                  const active = !disabledAvoids.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => onToggleAvoid(item)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        cursor: 'pointer',
                        padding: '8px 14px',
                        borderRadius: 9999,
                        border: `1px solid ${active ? PALETTE.gold : 'rgba(255,255,255,0.16)'}`,
                        background: active ? 'rgba(212,160,36,0.14)' : 'transparent',
                        fontFamily: FONT_BODY,
                        fontWeight: 600,
                        fontSize: 12.5,
                        color: active ? PALETTE.goldBright : 'rgba(255,255,255,0.45)',
                        textDecoration: active ? 'none' : 'line-through',
                      }}
                    >
                      {active ? <Ban size={13} /> : null}
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Search CTA */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onSearch}
          disabled={selected.length === 0 || isSearching}
          style={{
            background: selected.length === 0 || isSearching ? 'rgba(212,160,36,0.4)' : PALETTE.gold,
            color: PALETTE.canvasDeep,
            border: 'none',
            padding: '16px 28px',
            borderRadius: 9999,
            fontFamily: FONT_BODY,
            fontWeight: 700,
            fontSize: 15,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            cursor: selected.length === 0 || isSearching ? 'not-allowed' : 'pointer',
            boxShadow: '0 14px 32px -10px rgba(212,160,36,0.55)',
            opacity: selected.length === 0 ? 0.7 : 1,
          }}
        >
          {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          {isSearching ? t('search.submitting') : t('search.submitCareers', { count: selected.length })}
        </button>
        <div style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.55)' }}>
          {t('search.timingNote')}
        </div>
      </div>

      {/* Recent searches — replay a previous configuration with one click.
          Backend cache makes the re-run effectively free. */}
      {recentSearches.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <div
            style={{
              fontFamily: FONT_BODY,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.45)',
              marginBottom: 10,
            }}
          >
            {t('search.recent')}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {recentSearches.map((s, i) => {
              const parts = [
                t('summary.careers', { count: s.selectedCareers.length }),
                [s.primaryCountry, s.secondaryCountry]
                  .filter(Boolean)
                  .map(countryLabelByCode)
                  .join(' + '),
                s.workArrangement !== 'any' ? t(`search.location.${s.workArrangement}`) : null,
                s.jobCommitment !== 'any'
                  ? s.jobCommitment === 'contract'
                    ? t('search.commitmentShort.contract')
                    : t(`search.commitment.${s.jobCommitment}`)
                  : null,
                relativeAgo(t, s.ranAt),
              ].filter(Boolean);
              return (
                <button
                  key={`${s.ranAt}-${i}`}
                  type="button"
                  onClick={() => onApplyRecentSearch(s)}
                  style={{
                    background: 'rgba(18, 46, 59, 0.55)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: 'rgba(255,255,255,0.78)',
                    padding: '8px 14px',
                    borderRadius: 9999,
                    fontFamily: FONT_BODY,
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                  title={t('search.restoreTitle')}
                >
                  {parts.join(' · ')}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  </LakeBackground>
  );
};

// "12m ago" / "3h ago" / "2d ago" — compact relative timestamp for the
// recent-searches chip text. Falls back to a date for anything older than a
// week so we don't end up with "63d ago" eyesores.
function relativeAgo(t: TFunction, ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return t('search.ago.justNow');
  const min = Math.floor(diff / 60_000);
  if (min < 60) return t('search.ago.minutes', { count: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t('search.ago.hours', { count: hr });
  const days = Math.floor(hr / 24);
  if (days < 7) return t('search.ago.days', { count: days });
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

// ── Career picker card ────────────────────────────────────────
const CareerPickerCard: React.FC<{
  career: JobsSearchCareerOption;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}> = ({ career, selected, disabled, onToggle }) => (
  <button
    type="button"
    onClick={!disabled ? onToggle : undefined}
    disabled={disabled}
    style={{
      position: 'relative',
      background: selected ? 'rgba(39, 161, 161, 0.20)' : 'rgba(18, 46, 59, 0.55)',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      border: selected ? '1.5px solid rgba(39, 161, 161, 0.60)' : '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: 18,
      padding: 20,
      textAlign: 'left',
      cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      opacity: disabled ? 0.4 : 1,
      transition: 'all 200ms ease',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <CareerTierBadge tier={career.tier} selected={selected} />
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: 9999,
          background: selected ? PALETTE.teal : 'transparent',
          border: selected ? `2px solid ${PALETTE.teal}` : '2px solid rgba(255,255,255,0.20)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected && <CheckCircle2 size={14} color="#fff" />}
      </div>
    </div>
    <div
      style={{
        fontFamily: FONT_DISPLAY,
        fontWeight: 700,
        fontSize: 17,
        letterSpacing: '-0.01em',
        color: '#fff',
        lineHeight: 1.2,
        minHeight: 44,
      }}
    >
      {career.title}
    </div>
    {career.shape && (
      <div style={{ fontFamily: FONT_BODY, fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.55)' }}>
        {career.shape}
      </div>
    )}
  </button>
);

// ── Cream-on-dark form fields ─────────────────────────────────
const FormField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label
      style={{
        display: 'block',
        marginBottom: 6,
        fontFamily: FONT_BODY,
        fontSize: 11,
        fontWeight: 700,
        color: 'rgba(255,255,255,0.55)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </label>
    {children}
  </div>
);

const CreamSelect: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: { code: string; label: string }[];
}> = ({ value, onChange, options }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    style={{
      width: '100%',
      height: 42,
      background: PALETTE.cream,
      color: PALETTE.canvasDeep,
      border: `1px solid ${PALETTE.tan}`,
      borderRadius: 10,
      padding: '0 14px',
      fontFamily: FONT_BODY,
      fontWeight: 600,
      fontSize: 14,
      appearance: 'none',
      WebkitAppearance: 'none',
      MozAppearance: 'none',
      backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M1 1L6 6L11 1' stroke='%23122E3B' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3e%3c/svg%3e")`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right 14px center',
      paddingRight: 36,
      cursor: 'pointer',
    }}
  >
    {options.map((o) => (
      <option key={o.code || '_'} value={o.code}>
        {o.label}
      </option>
    ))}
  </select>
);

const CreamInput: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string }> = ({
  value,
  onChange,
  placeholder,
}) => (
  <input
    type="text"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    style={{
      width: '100%',
      height: 42,
      boxSizing: 'border-box',
      background: PALETTE.cream,
      color: PALETTE.canvasDeep,
      border: `1px solid ${PALETTE.tan}`,
      borderRadius: 10,
      padding: '0 14px',
      fontFamily: FONT_BODY,
      fontWeight: 500,
      fontSize: 14,
      outline: 'none',
    }}
  />
);
