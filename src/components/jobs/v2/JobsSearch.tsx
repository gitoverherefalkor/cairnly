// Jobs · Search — pre-results state. Career picker + location filters + the
// big gold "Search N careers" CTA. Replaces the prod CareerSelector +
// LocationInput components' UI; their data exports (COUNTRIES,
// profileCountryToCode) are still used.

import React, { useState } from 'react';
import { CheckCircle2, Clock, Globe, Heart, Loader2, Search, SlidersHorizontal, ChevronDown } from 'lucide-react';
import {
  PALETTE,
  FONT_DISPLAY,
  FONT_BODY,
  LakeBackground,
} from '@/components/dashboard/v2/dashboardV2Shared';
import { DashboardAppNav } from '@/components/dashboard/v2/DashboardAppNav';
import { CareerTierBadge, JEyebrow, type JobsTier, TIER_LABEL } from './jobsV2Shared';
import type { WorkArrangement, JobCommitment } from '@/hooks/useJobSearch';

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

const WORK_OPTIONS: { value: WorkArrangement; label: string }[] = [
  { value: 'any', label: 'Any location' },
  { value: 'remote_friendly', label: 'Remote-friendly' },
  { value: 'remote_only', label: 'Remote only' },
];

const COMMITMENT_OPTIONS: { value: JobCommitment; label: string }[] = [
  { value: 'any', label: 'Any hours' },
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract / Freelance' },
];

// Collapsible panel showing the "avoid" preferences pulled from the user's
// assessment. Each item is a toggle — unchecking it means "don't filter this
// out for this search" (people forget what they marked to avoid months ago).
const AvoidFoldout: React.FC<{
  items: string[];
  disabled: string[];
  onToggle: (item: string) => void;
}> = ({ items, disabled, onToggle }) => {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  const activeCount = items.length - disabled.filter((d) => items.includes(d)).length;

  return (
    <section style={{ marginBottom: 32 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          textAlign: 'left',
          background: 'rgba(18, 46, 59, 0.55)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: open ? '18px 18px 0 0' : 18,
          padding: '14px 18px',
          cursor: 'pointer',
          fontFamily: FONT_BODY,
          color: '#fff',
        }}
      >
        <SlidersHorizontal size={15} color={PALETTE.goldBright} />
        <span style={{ fontSize: 13.5, fontWeight: 700 }}>
          Hiding roles you said you'd avoid
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 500, color: 'rgba(255,255,255,0.55)' }}>
          {activeCount} of {items.length} active
        </span>
        <ChevronDown
          size={16}
          style={{
            marginLeft: 'auto',
            transition: 'transform 0.15s ease',
            transform: open ? 'rotate(180deg)' : 'none',
            color: 'rgba(255,255,255,0.6)',
          }}
        />
      </button>
      {open && (
        <div
          style={{
            background: 'rgba(18, 46, 59, 0.55)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderTop: 'none',
            borderRadius: '0 0 18px 18px',
            padding: 18,
          }}
        >
          <p
            style={{
              fontFamily: FONT_BODY,
              fontSize: 12.5,
              fontWeight: 500,
              lineHeight: 1.5,
              color: 'rgba(255,255,255,0.55)',
              margin: '0 0 14px 0',
              maxWidth: 640,
            }}
          >
            From your assessment. We lower the score of roles matching these, so they drop off your
            list. Uncheck any you'd actually consider for this search.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {items.map((item) => {
              const active = !disabled.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => onToggle(item)}
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
                  {active ? <CheckCircle2 size={13} /> : null}
                  {item}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};

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
}) => (
  <LakeBackground intensity="normal">
    <DashboardAppNav
      firstName={firstName}
      pageLabel="Find Open Roles"
      onProfile={onProfile}
      onSignOut={onSignOut}
      onBack={onBack}
      backLabel="Back to dashboard"
    />

    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '48px 32px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 36, gap: 24, flexWrap: 'wrap' }}>
        <div>
          <JEyebrow>STEP 1 · UNLOCKED · TIER 1 OF 3</JEyebrow>
          <h1
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: 48,
              letterSpacing: '-0.03em',
              color: '#fff',
              margin: '12px 0 8px 0',
              lineHeight: 1.0,
            }}
          >
            Find live openings.
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
              fontWeight: 800,
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
            Saved roles · {savedCount}
          </button>
        )}
      </div>

      {/* Career picker */}
      <section style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
          <JEyebrow>CAREERS TO SEARCH</JEyebrow>
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
            Your report doesn't have career suggestions yet. Finish the coach conversation first.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
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

      {/* Location */}
      <section style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 14, gap: 8 }}>
          <JEyebrow>WHERE</JEyebrow>
        </div>
        <div
          style={{
            background: 'rgba(18, 46, 59, 0.55)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 18,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, alignItems: 'end' }}>
            <FormField label="Country">
              <CreamSelect value={primaryCountry} onChange={onPrimaryCountryChange} options={countries} />
            </FormField>
            <FormField label="+ Another country (optional)">
              <CreamSelect
                value={secondaryCountry}
                onChange={onSecondaryCountryChange}
                options={[{ code: '', label: 'None' }, ...countries.filter((c) => c.code !== primaryCountry)]}
              />
            </FormField>
            <FormField label="City (optional)">
              <CreamInput value={city} onChange={onCityChange} placeholder="Amsterdam, Berlin…" />
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
              Work arrangement
            </div>
            <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 8 }}>
              {WORK_OPTIONS.map((opt) => {
                const active = workArrangement === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onWorkArrangementChange(opt.value)}
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
                    {opt.value !== 'any' && <Globe size={14} />}
                    {opt.label}
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
              "Remote" surfaces remote roles posted for the countries you picked. We don't yet search
              for roles that are remote <em>anywhere in the world</em>. Want that? Let us know via the
              Feedback &amp; Support button, bottom-right.
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
              Hours / commitment
            </div>
            <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 8 }}>
              {COMMITMENT_OPTIONS.map((opt) => {
                const active = jobCommitment === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onJobCommitmentChange(opt.value)}
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
                    {opt.value !== 'any' && <Clock size={14} />}
                    {opt.label}
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
              Filtering by hours narrows to roles tagged that way on LinkedIn. Part-time and contract
              roles are rarer than full-time, so these can return noticeably fewer results. Leave it on
              "Any hours" for the widest search.
            </p>
          </div>
        </div>
      </section>

      <AvoidFoldout items={avoidPreferences} disabled={disabledAvoids} onToggle={onToggleAvoid} />

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
            fontWeight: 800,
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
          {isSearching
            ? 'Searching…'
            : `Search ${selected.length} ${selected.length === 1 ? 'career' : 'careers'}`}
        </button>
        <div style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.55)' }}>
          Typical search takes 20 to 40 seconds. Live results stream in as each career completes.
        </div>
      </div>
    </div>
  </LakeBackground>
);

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
      <CareerTierBadge tier={career.tier} tierLabel={TIER_LABEL[career.tier]} selected={selected} />
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
