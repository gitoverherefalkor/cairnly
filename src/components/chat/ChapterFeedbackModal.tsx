import React, { useState, type ComponentType } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Sparkles,
  X,
  Lightbulb,
  HandHeart,
  Meh,
  Frown,
  MessageCircle,
  ScrollText,
  Check,
  Zap,
  Star,
  Sprout,
} from 'lucide-react';

// Chapter feedback modal — shown after the user finishes Chapter 1
// (Approach → Strengths → Development → Values) and clicks Continue
// from values. Captures structured feedback before the platform delivers
// the first career match.

export type ChapterFeedbackQuality =
  | 'insightful'
  | 'encouraging'
  | 'too_obvious'
  | 'off_the_mark'
  | 'other';
export type ChapterFeedbackLength = 'too_long' | 'just_right' | 'too_short';
export type ChapterFeedbackSubsection = 'approach' | 'strengths' | 'development' | 'values';

export interface ChapterFeedbackPayload {
  quality: ChapterFeedbackQuality[];
  length: ChapterFeedbackLength | null;
  strongest_subsection: ChapterFeedbackSubsection | null;
  weakest_subsection: ChapterFeedbackSubsection | null;
  free_text: string | null;
}

interface ChapterFeedbackModalProps {
  open: boolean;
  firstName?: string;
  onSubmit: (payload: ChapterFeedbackPayload) => Promise<void> | void;
  // Soft cancel — closes the modal without submitting. The user's Continue
  // click is voided; they can resume chatting and click Continue again later.
  onCancel: () => void;
}

// Theme classes per quality option — separate selected vs unselected so
// each chip has its own personality when chosen but a calm look at rest.
interface QualityOption {
  value: ChapterFeedbackQuality;
  label: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
  selectedClasses: string;
  selectedIconClasses: string;
}

const QUALITY_OPTIONS: QualityOption[] = [
  {
    value: 'insightful',
    label: 'Insightful',
    Icon: Lightbulb,
    selectedClasses: 'bg-amber-50 border-amber-400 text-amber-800 shadow-sm',
    selectedIconClasses: 'text-amber-500',
  },
  {
    value: 'encouraging',
    label: 'Encouraging',
    Icon: HandHeart,
    selectedClasses: 'bg-emerald-50 border-emerald-400 text-emerald-800 shadow-sm',
    selectedIconClasses: 'text-emerald-500',
  },
  {
    value: 'too_obvious',
    label: 'Too obvious',
    Icon: Meh,
    selectedClasses: 'bg-slate-100 border-slate-400 text-slate-700 shadow-sm',
    selectedIconClasses: 'text-slate-500',
  },
  {
    value: 'off_the_mark',
    label: 'Off the mark',
    Icon: Frown,
    selectedClasses: 'bg-rose-50 border-rose-400 text-rose-800 shadow-sm',
    selectedIconClasses: 'text-rose-500',
  },
  {
    value: 'other',
    label: 'Other',
    Icon: MessageCircle,
    selectedClasses: 'bg-indigo-50 border-indigo-400 text-indigo-800 shadow-sm',
    selectedIconClasses: 'text-indigo-500',
  },
];

interface LengthOption {
  value: ChapterFeedbackLength;
  label: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
  // Selected styling per option — "too long" reads as negative feedback,
  // so it gets a rose treatment instead of the positive teal fill.
  selectedClasses: string;
  selectedIconClasses: string;
}

const LENGTH_OPTIONS: LengthOption[] = [
  {
    value: 'too_long',
    label: 'Too long',
    Icon: ScrollText,
    selectedClasses: 'border-rose-400 bg-rose-50 text-rose-800 shadow-sm',
    selectedIconClasses: 'text-rose-500',
  },
  {
    value: 'just_right',
    label: 'Just right',
    Icon: Check,
    selectedClasses: 'border-atlas-teal bg-atlas-teal text-white shadow-md',
    selectedIconClasses: 'text-white',
  },
  {
    value: 'too_short',
    label: 'Too short',
    Icon: Zap,
    selectedClasses: 'border-atlas-teal bg-atlas-teal text-white shadow-md',
    selectedIconClasses: 'text-white',
  },
];

interface SubsectionOption {
  value: ChapterFeedbackSubsection;
  label: string;
}

const SUBSECTION_OPTIONS: SubsectionOption[] = [
  { value: 'approach', label: 'Your Approach' },
  { value: 'strengths', label: 'Your Strengths' },
  { value: 'development', label: 'Development Areas' },
  { value: 'values', label: 'Career Values' },
];

export const ChapterFeedbackModal: React.FC<ChapterFeedbackModalProps> = ({
  open,
  firstName,
  onSubmit,
  onCancel,
}) => {
  const [quality, setQuality] = useState<ChapterFeedbackQuality[]>([]);
  const [length, setLength] = useState<ChapterFeedbackLength | null>(null);
  const [strongest, setStrongest] = useState<ChapterFeedbackSubsection | null>(null);
  const [weakest, setWeakest] = useState<ChapterFeedbackSubsection | null>(null);
  const [freeText, setFreeText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const toggleQuality = (q: ChapterFeedbackQuality) => {
    setQuality((curr) =>
      curr.includes(q) ? curr.filter((x) => x !== q) : [...curr, q]
    );
  };

  const toggleSubsection = (
    current: ChapterFeedbackSubsection | null,
    setFn: (v: ChapterFeedbackSubsection | null) => void,
    value: ChapterFeedbackSubsection,
  ) => {
    // Click-to-toggle: clicking the selected option clears it
    setFn(current === value ? null : value);
  };

  // Submit gate: at least one signal across any field
  const canSubmit =
    quality.length > 0 ||
    length !== null ||
    strongest !== null ||
    weakest !== null ||
    freeText.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        quality,
        length,
        strongest_subsection: strongest,
        weakest_subsection: weakest,
        free_text: freeText.trim() || null,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Reset state when modal closes so re-open is fresh
  React.useEffect(() => {
    if (!open) {
      setQuality([]);
      setLength(null);
      setStrongest(null);
      setWeakest(null);
      setFreeText('');
    }
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && !submitting && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-atlas-navy/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-0 shadow-2xl border border-gray-200 overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          {/* Soft-cancel close button — top right */}
          <button
            onClick={onCancel}
            disabled={submitting}
            className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Close — return to chat"
          >
            <X size={18} />
          </button>

          {/* Header — encouraging tone */}
          <div className="bg-gradient-to-br from-atlas-teal/10 to-atlas-teal/5 px-6 sm:px-8 pt-7 pb-5 border-b border-atlas-teal/15">
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles size={16} className="text-atlas-teal" />
              <span className="text-xs font-semibold text-atlas-teal uppercase tracking-wider">
                Chapter 1 complete
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-atlas-navy mb-1.5">
              {firstName ? `Nice work, ${firstName}.` : 'Nice work.'}
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              You just covered your personality profile. Before we move into your
              career suggestions, take a moment to tell us how this part landed.
              Quick to answer, gold for us.
            </p>
          </div>

          {/* Body — scrollable on small screens */}
          <div className="px-6 sm:px-8 py-5 max-h-[55vh] overflow-y-auto space-y-6">
            {/* 1. Quality grid (multi-select) — icon chips with per-option color theme */}
            <div>
              <label className="block text-sm font-semibold text-atlas-navy mb-2.5">
                How did this section land?
                <span className="ml-1.5 text-xs font-normal text-gray-500">
                  pick any
                </span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {QUALITY_OPTIONS.map((opt) => {
                  const selected = quality.includes(opt.value);
                  const Icon = opt.Icon;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleQuality(opt.value)}
                      className={`group p-3 rounded-xl border-2 transition-all duration-150 flex flex-col items-center justify-center gap-1.5 text-center hover:-translate-y-0.5 active:translate-y-0 ${
                        selected
                          ? opt.selectedClasses
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <Icon
                        size={22}
                        className={`transition-transform duration-150 group-hover:scale-110 ${
                          selected ? opt.selectedIconClasses : 'text-gray-400'
                        }`}
                      />
                      <span className="text-xs sm:text-[13px] font-semibold leading-tight">
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Length (single-select) — pills with icons */}
            <div>
              <label className="block text-sm font-semibold text-atlas-navy mb-2.5">
                Length felt:
              </label>
              <div className="flex gap-2 flex-wrap">
                {LENGTH_OPTIONS.map((opt) => {
                  const selected = length === opt.value;
                  const Icon = opt.Icon;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setLength(selected ? null : opt.value)}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full border-2 text-sm font-medium transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 ${
                        selected
                          ? opt.selectedClasses
                          : 'border-gray-200 bg-white text-gray-700 hover:border-atlas-teal/50 hover:bg-atlas-teal/5'
                      }`}
                    >
                      <Icon size={14} className={selected ? opt.selectedIconClasses : 'text-atlas-teal'} />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Strongest subsection (optional) — green star pills */}
            <div>
              <label className="block text-sm font-semibold text-atlas-navy mb-2.5 inline-flex items-center gap-1.5">
                <Star size={14} className="text-emerald-500 fill-emerald-500" />
                Strongest subsection?
                <span className="ml-1 text-xs font-normal text-gray-500">
                  optional
                </span>
              </label>
              <div className="flex flex-wrap gap-2">
                {SUBSECTION_OPTIONS.map((opt) => {
                  const selected = strongest === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleSubsection(strongest, setStrongest, opt.value)}
                      className={`px-3.5 py-1.5 rounded-full border-2 text-sm font-medium transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 ${
                        selected
                          ? 'border-emerald-400 bg-emerald-50 text-emerald-800 shadow-sm'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-emerald-300 hover:bg-emerald-50/40'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Weakest subsection (optional) — sprout pills (room to grow) */}
            <div>
              <label className="block text-sm font-semibold text-atlas-navy mb-2.5 inline-flex items-center gap-1.5">
                <Sprout size={14} className="text-rose-400" />
                Weakest subsection?
                <span className="ml-1 text-xs font-normal text-gray-500">
                  optional
                </span>
              </label>
              <div className="flex flex-wrap gap-2">
                {SUBSECTION_OPTIONS.map((opt) => {
                  const selected = weakest === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleSubsection(weakest, setWeakest, opt.value)}
                      className={`px-3.5 py-1.5 rounded-full border-2 text-sm font-medium transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 ${
                        selected
                          ? 'border-rose-400 bg-rose-50 text-rose-800 shadow-sm'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-rose-300 hover:bg-rose-50/40'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. Free text (optional) */}
            <div>
              <label className="block text-sm font-semibold text-atlas-navy mb-2.5">
                Anything else we could do better in this section?
                <span className="ml-1.5 text-xs font-normal text-gray-500">
                  optional
                </span>
              </label>
              <textarea
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="A line or two is plenty…"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-atlas-teal focus:ring-2 focus:ring-atlas-teal/20 resize-none"
              />
            </div>
          </div>

          {/* Footer — submit button */}
          <div className="bg-gray-50 px-6 sm:px-8 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              {canSubmit
                ? "Thanks. Let's continue."
                : 'Pick at least one option to continue.'}
            </p>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="bg-atlas-teal text-white rounded-full px-5 py-2.5 text-sm font-semibold hover:bg-atlas-teal/90 active:bg-atlas-teal/80 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {submitting ? 'Submitting…' : 'Continue to careers →'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
