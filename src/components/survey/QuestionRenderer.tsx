import React, { useState, useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { Question } from '@/hooks/useSurvey';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { GripVertical, Mic, Loader2, X, Plus } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { CAREER_HAPPINESS_MIN_REASON_CHARS } from './questionValidation';

interface QuestionRendererProps {
  question: Question;
  value: any;
  onChange: (value: any) => void;
  allResponses?: Record<string, any>; // For cross-question access (e.g., career_happiness needs career_history)
}

// Career history entry type - comprehensive (satisfaction is separate question)
interface CareerHistoryEntry {
  title: string;
  companyName: string;
  companySize: string;
  companyCulture: string;
  sector: string;
  yearsInRole: number | '';
  startMonth: string;
  startYear: number | '';
  endMonth: string;
  endYear: number | '';
  isCurrent: boolean;
}

// Career happiness entry type (separate question)
// Uses title + companyName as unique key so duplicate titles (e.g. two "Product Manager" roles) stay independent
interface CareerHappinessEntry {
  title: string;
  companyName: string;
  happiness: number;
  reason: string;
}

// Per-company achievement entry
interface CompanyAchievement {
  company: string;
  yearRange: string;
  text: string;
}

// Skills & Achievements entry type
// topSkills preserves the order skills came in from the CV (or user edits).
// topSkillRanks is a parallel array: 0 = unranked, 1/2/3 = the three slots the
// user picked as their top 3. At submission we rebuild a 3-item top_skills
// array from the ranks so n8n keeps its unchanged payload shape.
// languages is rendered as a third section in the same question; payload key is
// kept inside this object so n8n's existing question_id (...11111111111f) stays
// the single source for skills + achievements + languages.
interface SkillsAchievementsEntry {
  topSkills: string[];
  topSkillRanks?: number[];
  certifications: string[];
  achievements: CompanyAchievement[];
  languages?: LanguagesEntry;
}

// Interests/Hobbies entry type
interface InterestsEntry {
  interests: string[];
}

// Languages entry type — `presets` maps preset language name to proficiency value;
// `other` is an optional single non-preset language with its own proficiency.
interface LanguagesEntry {
  presets: Record<string, string>;
  other: { language: string; proficiency: string } | null;
}

// Company size and culture options
const COMPANY_SIZE_OPTIONS = [
  { value: 'Micro (1-10)', label: 'Micro (1-10 employees)', description: '' },
  { value: 'Small (11-50)', label: 'Small (11-50 employees)', description: '' },
  { value: 'Medium (51-200)', label: 'Medium (51-200 employees)', description: '' },
  { value: 'Large (201-1000)', label: 'Large (201-1000 employees)', description: '' },
  { value: 'Enterprise (1000-5000)', label: 'Enterprise (1000-5000 employees)', description: '' },
  { value: 'Multi National (5000+)', label: 'Multi National (5000+ employees)', description: '' },
  { value: 'Own Company', label: 'Own Company', description: 'Freelance, consulting, or own business' },
];

const COMPANY_CULTURE_OPTIONS = [
  { value: 'Startup / Scale-up', label: 'Startup / Scale-up', description: 'Investor backed, focus on growth, evolving structure' },
  { value: 'Corporate', label: 'Corporate', description: 'Established, structured hierarchy, stable' },
  { value: 'Mid-Market', label: 'Mid-Market', description: 'Balanced growth, professionalized, cross-functional' },
  { value: 'Agency / Consultancy', label: 'Agency / Consultancy', description: 'Client-centric, project-based, high variety' },
  { value: 'Boutique / Niche', label: 'Boutique / Niche', description: 'Specialized firm, small team, direct impact' },
  { value: 'Nonprofit / Social Impact', label: 'Nonprofit / Social Impact', description: 'Mission-driven, purpose-focused, collaborative' },
  { value: 'Public Sector / Gov', label: 'Public Sector / Gov', description: 'Formal procedures, regulatory, public service' },
  { value: 'Solo / Freelance', label: 'Solo / Freelance', description: 'Working independently, serving clients, no co-workers' },
  { value: 'Small Business Owner (up to 5 FTE)', label: 'Small Business Owner (up to 5 FTE)', description: 'Running my own company with employees or contractors' },
];

// Textarea that grows with its content (no inner scrollbar). Used for free-text
// achievement fields where users paste bullet lists of varying length.
const AutoResizeTextarea: React.FC<
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { minHeightPx?: number }
> = ({ minHeightPx = 60, value, onChange, className, ...rest }) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(minHeightPx, el.scrollHeight)}px`;
  };
  useEffect(() => {
    resize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => {
        onChange?.(e);
        resize();
      }}
      className={className}
      style={{ minHeight: `${minHeightPx}px`, overflow: 'hidden' }}
      {...rest}
    />
  );
};

// Ranking Component — tap to build a ranking. Items start unranked under
// "Tap to add"; tapping one moves it into "Your ranking" with the next number.
// Ranked items can be reordered by dragging the grip (@dnd-kit, works on mouse,
// trackpad and touch) and removed with the × button. The question only counts
// as answered once every item is ranked, so it can't be skipped.

// One ranked (draggable) row.
const SortableRankItem: React.FC<{
  id: string;
  index: number;
  label: React.ReactNode;
  onRemove: () => void;
}> = ({ id, index, label, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group relative flex items-center p-4 bg-white rounded-lg border-2 transition-shadow
        ${isDragging
          ? 'opacity-80 shadow-lg border-blue-400 z-10'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-md'}
      `}
    >
      <div className="flex items-center justify-center w-8 h-8 bg-background text-white rounded-full font-bold text-sm mr-4 flex-shrink-0">
        {index + 1}
      </div>

      {/* Drag handle — touch-none lets a finger drag the handle to reorder
          instead of scrolling the page. */}
      <button
        type="button"
        aria-label="Drag to reorder"
        className="flex items-center mr-3 text-gray-400 hover:text-gray-600 transition-colors cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <div className="flex-1">
        <span className="text-base font-light leading-relaxed">{label}</span>
      </div>

      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove from ranking"
        title="Remove"
        className="ml-3 flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
};

const ResponsiveRanking: React.FC<{
  question: any;
  value: any;
  onChange: (value: any) => void;
  formatTextWithEmphasis: (text: string) => { __html: string };
  renderChoiceLabel: (choice: string) => React.ReactNode;
}> = ({ question, value, onChange, renderChoiceLabel }) => {
  const choices: string[] = question.config?.choices || [];

  // The value is the ordered list of ranked items (grows as the user taps).
  // Unranked items are the remaining choices, shown in their original order.
  const ranked: string[] = Array.isArray(value) ? value.filter((v) => choices.includes(v)) : [];
  const unranked: string[] = choices.filter((c) => !ranked.includes(c));

  // Mouse, trackpad and touch all work via PointerSensor; the distance
  // constraint means a tap is never mistaken for a drag. KeyboardSensor adds
  // keyboard reordering for accessibility.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const addToRanking = (item: string) => onChange([...ranked, item]);
  const removeFromRanking = (item: string) => onChange(ranked.filter((x) => x !== item));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ranked.indexOf(active.id as string);
    const newIndex = ranked.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(ranked, oldIndex, newIndex));
  };

  return (
    <div className="space-y-5">
      {/* Instructions */}
      <div className="flex items-center gap-2 text-sm text-gray-600 p-3 bg-blue-50 rounded-lg">
        <span>
          <strong>Tap items in your order of importance.</strong> Drag the grip handle to reorder, tap the × to remove.
        </span>
      </div>

      {/* Your ranking */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Your ranking</span>
          <span className="text-xs text-gray-500">{ranked.length} of {choices.length} ranked</span>
        </div>

        {ranked.length === 0 ? (
          <div className="p-4 rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-400 text-center">
            Tap an item below to add it as #1
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={ranked} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {ranked.map((item, index) => (
                  <SortableRankItem
                    key={item}
                    id={item}
                    index={index}
                    label={renderChoiceLabel(item)}
                    onRemove={() => removeFromRanking(item)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Tap to add */}
      {unranked.length > 0 && (
        <div>
          <div className="text-sm font-medium text-gray-700 mb-2">Tap to add</div>
          <div className="space-y-2">
            {unranked.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => addToRanking(item)}
                className="w-full flex items-center gap-3 p-4 bg-white rounded-lg border-2 border-gray-200 hover:border-atlas-teal hover:bg-atlas-teal/5 text-left transition-colors"
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-dashed border-gray-300 text-gray-400 flex-shrink-0">
                  <Plus className="h-4 w-4" />
                </span>
                <span className="flex-1 text-base font-light leading-relaxed">{renderChoiceLabel(item)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const QuestionRenderer: React.FC<QuestionRendererProps> = ({
  question,
  value,
  onChange,
  allResponses,
}) => {
  const [otherValue, setOtherValue] = useState('');
  const [showOther, setShowOther] = useState(false);

  // Initialize "Other" value from stored response.
  // Array may contain either 'Other: <text>' (filled) or 'other' (sentinel:
  // checked but empty — present so the validator can block Continue).
  React.useEffect(() => {
    if (typeof value === 'string' && value.startsWith('Other: ')) {
      const extractedValue = value.replace('Other: ', '');
      setOtherValue(extractedValue);
    } else if (Array.isArray(value)) {
      const otherResponse = value.find((v: string) => typeof v === 'string' && v.startsWith('Other: '));
      if (otherResponse) {
        const extractedValue = otherResponse.replace('Other: ', '');
        setOtherValue(extractedValue);
        setShowOther(true);
      } else if (value.includes('other')) {
        setShowOther(true);
      }
    }
  }, [value]);

  // Clean stale values that no longer match current choices (e.g. after choice labels are renamed)
  useEffect(() => {
    if (question.type === 'multiple_choice' && question.allow_multiple && Array.isArray(value) && value.length > 0) {
      const validChoices = question.config?.choices || [];
      const cleaned = value.filter((v: string) =>
        v === 'other' || v.startsWith('Other: ') || validChoices.includes(v)
      );
      if (cleaned.length !== value.length) {
        onChange(cleaned);
      }
    }
  }, [question.config?.choices]);

  const handleMultipleChoiceChange = (optionValue: string, checked: boolean) => {
    const currentValues = Array.isArray(value) ? value : [];
    const maxSelections = question.max_selections;

    if (checked) {
      if (maxSelections && currentValues.length >= maxSelections) {
        return;
      }
      onChange([...currentValues, optionValue]);
    } else {
      onChange(currentValues.filter((v: string) => v !== optionValue));
    }
  };

  const handleOtherChange = (otherText: string) => {
    setOtherValue(otherText);
    const currentValues = Array.isArray(value) ? value : [];
    const maxSelections = question.max_selections;
    const hasOtherSlot = currentValues.some(
      (v: string) => v === 'other' || v.startsWith('Other: ')
    );

    // Strip both filled and sentinel forms, then re-add whichever is correct.
    const withoutOther = currentValues.filter(
      (v: string) => v !== 'other' && !v.startsWith('Other: ')
    );

    if (otherText) {
      // Adding a brand-new Other: enforce the selection limit.
      if (!hasOtherSlot && maxSelections && withoutOther.length >= maxSelections) {
        return;
      }
      onChange([...withoutOther, `Other: ${otherText}`]);
    } else {
      // Empty text: keep the 'other' sentinel so the validator blocks Continue
      // until the user types at least OTHER_MIN_CHARS chars.
      onChange([...withoutOther, 'other']);
    }
  };

  // Function to format text with emphasis and line breaks (sanitized against XSS)
  const formatTextWithEmphasis = (text: string) => {
    const formattedText = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\\n/g, '<br>');
    return { __html: DOMPurify.sanitize(formattedText, { ALLOWED_TAGS: ['strong', 'br', 'em'] }) };
  };

  // Display-only translation of a choice. The English `choice` stays the
  // stored/submitted value; we only swap what the user sees. Falls back to
  // English when no translation exists. See LOCALIZATION_PLAYBOOK.md.
  const displayChoice = (choice: string) => question.choiceLabels?.[choice] ?? choice;

  // Renders a choice label with the bold title on the first line and any
  // trailing "(e.g., ...)" description on its own line below, smaller and
  // muted. Display only — the choice string and stored value never change.
  const renderChoiceLabel = (choice: string) => {
    const shown = displayChoice(choice);
    const match = shown.match(/^\*\*(.+?)\*\*\s*([\s\S]*)$/);
    if (!match) {
      return <span dangerouslySetInnerHTML={formatTextWithEmphasis(shown)} />;
    }
    const [, title, description] = match;
    const trimmedDescription = description.trim();
    return (
      <>
        <span className="font-semibold">{title}</span>
        {trimmedDescription && (
          <span className="block text-sm font-normal text-gray-500 mt-0.5">
            {trimmedDescription}
          </span>
        )}
      </>
    );
  };

  const renderDescription = () => {
    if (!question.config?.description) return null;
    
    return (
      <div 
        className="text-sm text-gray-600 mt-2 mb-4 leading-relaxed"
        dangerouslySetInnerHTML={formatTextWithEmphasis(question.config.description)}
      />
    );
  };

  const getSelectionLimitText = () => {
    const maxSelections = question.max_selections;
    // A required multi-select needs at least one choice even when min_selections
    // isn't set in the database. Default the minimum to 1 so users are told the
    // question is mandatory, instead of the Continue button silently staying off.
    const minSelections = question.min_selections ?? (question.required ? 1 : 0);
    const currentSelections = Array.isArray(value) ? value.length : 0;

    if (!minSelections && !maxSelections) return null;

    let requirement: string;
    if (minSelections && maxSelections) {
      requirement = minSelections === maxSelections
        ? `Select ${minSelections}`
        : `Select between ${minSelections} and ${maxSelections}`;
    } else if (minSelections) {
      requirement = minSelections === 1 ? 'Select at least one' : `Select at least ${minSelections}`;
    } else {
      requirement = `Select up to ${maxSelections}`;
    }

    const met =
      currentSelections >= minSelections &&
      (!maxSelections || currentSelections <= maxSelections);

    return (
      <p className="text-sm text-gray-600 mb-4">
        {requirement}
        {currentSelections > 0 && (
          <span className={met ? 'text-atlas-teal' : 'text-gray-400'}> · {currentSelections} selected</span>
        )}
      </p>
    );
  };

  const isSelectionLimitReached = () => {
    const maxSelections = question.max_selections;
    const currentSelections = Array.isArray(value) ? value.length : 0;
    return maxSelections && currentSelections >= maxSelections;
  };

  switch (question.type) {
    case 'short_text':
      return (
        <div>
          <div 
            className="text-xl font-semibold mb-6"
            dangerouslySetInnerHTML={formatTextWithEmphasis(question.label)}
          />
          {renderDescription()}
          {/* Use a textarea for short_text to allow multiline and more space */}
          <textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enter your response..."
            className="w-full rounded-md border border-gray-300 bg-[#ffffff] text-[#111827] px-3 py-2 text-base leading-relaxed resize-y min-h-[120px]"
            rows={5}
          />
        </div>
      );

    case 'long_text':
      return (
        <LongTextWithVoice
          question={question}
          value={value}
          onChange={onChange}
          formatTextWithEmphasis={formatTextWithEmphasis}
          renderDescription={renderDescription}
        />
      );

    case 'number':
      return (
        <div>
          <div 
            className="text-xl font-semibold mb-6"
            dangerouslySetInnerHTML={formatTextWithEmphasis(question.label)}
          />
          {renderDescription()}
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : '')}
            placeholder="Enter a number..."
            className="w-full"
          />
        </div>
      );

    case 'dropdown':
      return (
        <div>
          <div 
            className="text-xl font-semibold mb-6"
            dangerouslySetInnerHTML={formatTextWithEmphasis(question.label)}
          />
          {renderDescription()}
          <Select value={value || ''} onValueChange={onChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select an option..." />
            </SelectTrigger>
            <SelectContent>
              {question.config?.choices?.map((choice) => (
                <SelectItem key={choice} value={choice}>
                  <span dangerouslySetInnerHTML={formatTextWithEmphasis(displayChoice(choice))} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );

    case 'multiple_choice': {
      // Two-column layout for long lists of short options — 8+ choices, each
      // <=50 chars. Sentence-style option lists stay single-column.
      const mcChoices = question.config?.choices ?? [];
      const useTwoCol = mcChoices.length >= 8 && mcChoices.every((c) => c.length <= 50);
      const mcListClass = useTwoCol ? 'grid grid-cols-1 md:grid-cols-2 gap-2' : 'space-y-2';
      if (!question.allow_multiple) {
        // Single selection with enhanced interaction.
        // "Other" stays active once selected even after the value becomes
        // `Other: <text>` — otherwise the text box unmounts on first keystroke.
        const isOtherActive =
          value === 'other' || (typeof value === 'string' && value.startsWith('Other: '));
        return (
          <div>
            <div
              className="text-xl font-semibold mb-6"
              dangerouslySetInnerHTML={formatTextWithEmphasis(question.label)}
            />
            {renderDescription()}
            <RadioGroup value={isOtherActive ? 'other' : (value || '')} onValueChange={onChange} className={mcListClass}>
              {question.config?.choices?.map((choice) => {
                const isSelected = value === choice;
                return (
                  <div 
                    key={choice} 
                    onClick={() => onChange(choice)}
                    className={`
                      group relative flex items-center p-4 rounded-lg border cursor-pointer
                      transition-all duration-200 hover:shadow-md
                      ${isSelected 
                        ? 'border-atlas-teal bg-atlas-teal/5 shadow-sm' 
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                      }
                    `}
                  >
                    <RadioGroupItem 
                      value={choice} 
                      id={`radio-${choice}`}
                      className={`
                        transition-all duration-200 flex-shrink-0
                        ${isSelected ? 'border-atlas-teal' : 'border-gray-300 group-hover:border-gray-400'}
                      `}
                    />
                    <Label 
                      htmlFor={`radio-${choice}`} 
                      className={`
                        text-base font-light leading-relaxed cursor-pointer ml-4 flex-1
                        transition-colors duration-200
                        ${isSelected ? 'text-atlas-navy font-medium' : 'text-gray-700 group-hover:text-gray-900'}
                      `}
                    >
                      {renderChoiceLabel(choice)}
                    </Label>
                    {/* Selection indicator */}
                    {isSelected && (
                      <div className="absolute right-4 text-atlas-teal">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })}
              {question.allow_other && (
                <div 
                  onClick={() => onChange('other')}
                  className={`
                    group relative flex items-center p-4 rounded-lg border cursor-pointer
                    transition-all duration-200 hover:shadow-md
                    ${useTwoCol ? 'md:col-span-2' : ''}
                    ${isOtherActive
                      ? 'border-atlas-teal bg-atlas-teal/5 shadow-sm' 
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }
                  `}
                >
                  <RadioGroupItem 
                    value="other" 
                    id="other"
                    className={`
                      transition-all duration-200 flex-shrink-0
                      ${isOtherActive ? 'border-atlas-teal' : 'border-gray-300 group-hover:border-gray-400'}
                    `}
                  />
                  <Label 
                    htmlFor="other" 
                    className={`
                      text-base font-light leading-relaxed cursor-pointer ml-4 flex-1
                      transition-colors duration-200
                      ${isOtherActive ? 'text-atlas-navy font-medium' : 'text-gray-700 group-hover:text-gray-900'}
                    `}
                  >
                    Other
                  </Label>
                  {isOtherActive && (
                    <div className="absolute right-4 text-atlas-teal">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              )}
            </RadioGroup>
            {question.allow_other && isOtherActive && (
              <div className="mt-4 animate-in slide-in-from-top-2 duration-200">
                <Input
                  value={otherValue}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setOtherValue(newValue);
                    onChange(newValue ? `Other: ${newValue}` : 'other');
                  }}
                  placeholder="Please specify..."
                  className="w-full bg-gray-50 border-0 focus:ring-0 focus:outline-none px-4 py-3 rounded-md mt-2"
                  autoFocus
                />
              </div>
            )}
          </div>
        );
      } else {
        // Multiple selection with enhanced interaction
        const currentValues = Array.isArray(value) ? value : [];
        return (
          <div>
            <div 
              className="text-xl font-semibold mb-6"
              dangerouslySetInnerHTML={formatTextWithEmphasis(question.label)}
            />
            {renderDescription()}
            {getSelectionLimitText()}
            <div className={mcListClass}>
              {question.config?.choices?.map((choice) => {
                const isChecked = currentValues.includes(choice);
                
                return (
                  <div 
                    key={choice} 
                    onClick={(e) => {
                      e.preventDefault();
                      handleMultipleChoiceChange(choice, !isChecked);
                    }}
                    className={`
                      group relative flex items-center p-4 rounded-lg border cursor-pointer
                      transition-all duration-200
                      ${isChecked 
                        ? 'border-atlas-teal bg-atlas-teal/5 shadow-sm hover:shadow-md'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 hover:shadow-md'
                      }
                    `}
                  >
                    <Checkbox
                      id={choice}
                      checked={isChecked}
                      onCheckedChange={(checked) => handleMultipleChoiceChange(choice, checked as boolean)}
                      className={`
                        transition-all duration-200 flex-shrink-0
                        ${isChecked ? 'border-atlas-teal data-[state=checked]:bg-atlas-teal' : 'border-gray-300 group-hover:border-gray-400'}
                      `}
                    />
                    <Label 
                      htmlFor={choice} 
                      className={`
                        text-base font-light leading-relaxed cursor-pointer ml-4 flex-1
                        transition-colors duration-200
                        ${isChecked
                          ? 'text-atlas-navy font-medium'
                          : 'text-gray-700 group-hover:text-gray-900'
                        }
                      `}
                    >
                      {renderChoiceLabel(choice)}
                    </Label>
                    {/* Selection indicator for checkboxes */}
                    {isChecked && (
                      <div className="absolute right-4 text-atlas-teal">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })}
              {question.allow_other && (
                <div className={`space-y-2 ${useTwoCol ? 'md:col-span-2' : ''}`}>
                  <div
                    onClick={(e) => {
                      e.preventDefault();
                      const hasOtherSlot = currentValues.some(
                        (v: string) => v === 'other' || v.startsWith('Other: ')
                      );
                      if (!showOther && !hasOtherSlot) {
                        // Block opening Other if selection limit is already reached
                        if (isSelectionLimitReached()) return;
                        setShowOther(true);
                        // Push sentinel immediately so Continue is blocked
                        // until the user types something.
                        onChange([...currentValues, 'other']);
                      } else {
                        // Remove the "Other" response (sentinel or filled)
                        setOtherValue('');
                        setShowOther(false);
                        onChange(
                          currentValues.filter(
                            (v: string) => v !== 'other' && !v.startsWith('Other: ')
                          )
                        );
                      }
                    }}
                    className={`
                      group relative flex items-center p-4 rounded-lg border cursor-pointer
                      transition-all duration-200 hover:shadow-md
                      ${(showOther || currentValues.some((v: string) => v.startsWith('Other: ')))
                        ? 'border-atlas-teal bg-atlas-teal/5 shadow-sm'
                        : (!showOther && !currentValues.some((v: string) => v.startsWith('Other: ')) && isSelectionLimitReached())
                          ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                      }
                    `}
                  >
                    <Checkbox
                      id="other-checkbox"
                      checked={
                        showOther ||
                        currentValues.some(
                          (v: string) => v === 'other' || v.startsWith('Other: ')
                        )
                      }
                      onCheckedChange={(checked) => {
                        const hasOtherSlot = currentValues.some(
                          (v: string) => v === 'other' || v.startsWith('Other: ')
                        );
                        if (checked && !showOther && !hasOtherSlot && isSelectionLimitReached()) {
                          return;
                        }
                        setShowOther(checked as boolean);
                        if (checked) {
                          if (!hasOtherSlot) {
                            // Push sentinel immediately so Continue is blocked
                            // until the user types something.
                            onChange([...currentValues, 'other']);
                          }
                        } else {
                          setOtherValue('');
                          onChange(
                            currentValues.filter(
                              (v: string) => v !== 'other' && !v.startsWith('Other: ')
                            )
                          );
                        }
                      }}
                      className={`
                        transition-all duration-200 flex-shrink-0
                        ${(showOther || currentValues.some((v: string) => v.startsWith('Other: '))) 
                          ? 'border-atlas-teal data-[state=checked]:bg-atlas-teal' 
                          : 'border-gray-300 group-hover:border-gray-400'
                        }
                      `}
                    />
                    <Label 
                      htmlFor="other-checkbox" 
                      className={`
                        text-base font-light leading-relaxed cursor-pointer ml-4 flex-1
                        transition-colors duration-200
                        ${(showOther || currentValues.some((v: string) => v.startsWith('Other: ')))
                          ? 'text-atlas-navy font-medium'
                          : 'text-gray-700 group-hover:text-gray-900'
                        }
                      `}
                    >
                      Other
                    </Label>
                  </div>
                  {(showOther || currentValues.some((v: string) => v.startsWith('Other: '))) && (
                    <div className="animate-in slide-in-from-top-2 duration-200 mt-2">
                      <Input
                        value={otherValue}
                        onChange={(e) => handleOtherChange(e.target.value)}
                        placeholder="Please specify..."
                        className="w-full bg-gray-50 border-0 focus:ring-0 focus:outline-none px-4 py-3 rounded-md"
                        autoFocus
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      }
    }

    case 'rating':
      const min = question.config?.min || 1;
      const max = question.config?.max || 10;
      const currentValue = value ? [value] : [min];
      
      return (
        <div>
          <div 
            className="text-xl font-semibold mb-6"
            dangerouslySetInnerHTML={formatTextWithEmphasis(question.label)}
          />
          {renderDescription()}
          <div className="space-y-4">
            <div className="px-4">
              <Slider
                value={currentValue}
                onValueChange={(newValue) => onChange(newValue[0])}
                min={min}
                max={max}
                step={1}
                className="w-full"
              />
            </div>
            <div className="flex justify-between text-sm text-gray-600 px-4">
              <span>{min}</span>
              <span className="font-medium text-lg text-atlas-navy">
                {currentValue[0]}
              </span>
              <span>{max}</span>
            </div>
          </div>
        </div>
      );

    case 'ranking':
      return (
        <div>
          <div 
            className="text-xl font-semibold mb-6"
            dangerouslySetInnerHTML={formatTextWithEmphasis(question.label)}
          />
          {renderDescription()}
          
          <ResponsiveRanking
            question={question}
            value={value}
            onChange={onChange}
            formatTextWithEmphasis={formatTextWithEmphasis}
            renderChoiceLabel={renderChoiceLabel}
          />
        </div>
      );

    case 'career_history':
      // Career history - comprehensive fields (satisfaction is separate question)
      const emptyEntry: CareerHistoryEntry = {
        title: '',
        companyName: '',
        companySize: '',
        companyCulture: '',
        sector: '',
        yearsInRole: '',
        startMonth: '',
        startYear: '',
        endMonth: '',
        endYear: '',
        isCurrent: false
      };

      // Month options
      const MONTHS = [
        { value: 'Jan', label: 'Jan' },
        { value: 'Feb', label: 'Feb' },
        { value: 'Mar', label: 'Mar' },
        { value: 'Apr', label: 'Apr' },
        { value: 'May', label: 'May' },
        { value: 'Jun', label: 'Jun' },
        { value: 'Jul', label: 'Jul' },
        { value: 'Aug', label: 'Aug' },
        { value: 'Sep', label: 'Sep' },
        { value: 'Oct', label: 'Oct' },
        { value: 'Nov', label: 'Nov' },
        { value: 'Dec', label: 'Dec' },
      ];

      // Calculate duration between dates
      const calculateDuration = (entry: CareerHistoryEntry): string => {
        if (!entry.startMonth || !entry.startYear) return '';

        const monthToNum: Record<string, number> = {
          'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
          'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
        };

        const startDate = new Date(Number(entry.startYear), monthToNum[entry.startMonth] || 0);
        let endDate: Date;

        if (entry.isCurrent) {
          endDate = new Date();
        } else if (entry.endMonth && entry.endYear) {
          endDate = new Date(Number(entry.endYear), monthToNum[entry.endMonth] || 0);
        } else {
          return '';
        }

        const totalMonths = (endDate.getFullYear() - startDate.getFullYear()) * 12 +
                           (endDate.getMonth() - startDate.getMonth());

        if (totalMonths < 0) return '';

        const years = Math.floor(totalMonths / 12);
        const months = totalMonths % 12;

        if (years === 0 && months === 0) return 'Less than a month';
        if (years === 0) return `${months} month${months !== 1 ? 's' : ''}`;
        if (months === 0) return `${years} year${years !== 1 ? 's' : ''}`;
        return `${years} year${years !== 1 ? 's' : ''}, ${months} month${months !== 1 ? 's' : ''}`;
      };

      // Parse value — keep all entries including empty ones the user just added
      // Only strip trailing empty entries from initial prefill (string or padded arrays)
      const careerHistoryValue: CareerHistoryEntry[] = Array.isArray(value)
        ? value
        : [];

      // Helper to convert month name to number for sorting
      const monthToNumber = (month: string): number => {
        const months: Record<string, number> = {
          'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
          'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
        };
        return months[month] || 0;
      };

      // Auto-sort by recency: current roles first, then by end date (desc), then start date (desc)
      const sortByRecency = (entries: CareerHistoryEntry[]): CareerHistoryEntry[] => {
        return [...entries].sort((a, b) => {
          // Empty entries go to the end
          const aEmpty = !a.title;
          const bEmpty = !b.title;
          if (aEmpty && !bEmpty) return 1;
          if (!aEmpty && bEmpty) return -1;
          if (aEmpty && bEmpty) return 0;

          // Current roles come first
          if (a.isCurrent && !b.isCurrent) return -1;
          if (!a.isCurrent && b.isCurrent) return 1;

          // Sort by end date (most recent first)
          const aEndYear = Number(a.endYear || a.startYear || 0);
          const bEndYear = Number(b.endYear || b.startYear || 0);
          if (aEndYear !== bEndYear) return bEndYear - aEndYear;

          const aEndMonth = monthToNumber(a.endMonth || a.startMonth || '');
          const bEndMonth = monthToNumber(b.endMonth || b.startMonth || '');
          if (aEndMonth !== bEndMonth) return bEndMonth - aEndMonth;

          // Then by start date
          const aStartYear = Number(a.startYear || 0);
          const bStartYear = Number(b.startYear || 0);
          if (aStartYear !== bStartYear) return bStartYear - aStartYear;

          return monthToNumber(b.startMonth || '') - monthToNumber(a.startMonth || '');
        });
      };

      const updateCareerHistory = (index: number, field: keyof CareerHistoryEntry, fieldValue: string | number | boolean) => {
        const newHistory = [...careerHistoryValue];
        newHistory[index] = { ...newHistory[index], [field]: fieldValue };

        // If marking as current, clear end month and year
        if (field === 'isCurrent' && fieldValue === true) {
          newHistory[index].endMonth = '';
          newHistory[index].endYear = '';
        }

        onChange(newHistory);
      };

      const MAX_ACTIVE_ROLES = 5;

      const addCareerRow = (position: 'top' | 'bottom' = 'bottom') => {
        // Only allow adding if fewer than 5 active (filled) entries in the top 5
        const activeCount = careerHistoryValue.slice(0, MAX_ACTIVE_ROLES).filter(e => e.title?.trim()).length;
        if (activeCount >= MAX_ACTIVE_ROLES) return;
        const newHistory = [...careerHistoryValue];
        if (position === 'top') {
          newHistory.unshift({ ...emptyEntry });
        } else {
          // Insert at position 5 max (before overflow), or at the end if < 5
          const insertAt = Math.min(newHistory.length, MAX_ACTIVE_ROLES);
          newHistory.splice(insertAt, 0, { ...emptyEntry });
        }
        onChange(newHistory);
      };

      const removeCareerRow = (index: number) => {
        const newHistory = [...careerHistoryValue];
        newHistory.splice(index, 1);
        onChange(newHistory);
      };

      const moveCareerRow = (index: number, direction: 'up' | 'down') => {
        const newHistory = [...careerHistoryValue];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newHistory.length) return;
        [newHistory[index], newHistory[targetIndex]] = [newHistory[targetIndex], newHistory[index]];
        onChange(newHistory);
      };

      const getRoleLabel = (index: number, entry: CareerHistoryEntry) => {
        const isOverflow = index >= MAX_ACTIVE_ROLES;
        if (isOverflow) return `${entry.title || `Role ${index + 1}`} — not included`;
        if (entry.isCurrent) return `Role ${index + 1} (Current)`;
        if (index === 0) return 'Role 1 (Most Recent)';
        return `Role ${index + 1}`;
      };

      // Generate year options (current year back to 50 years ago)
      const currentYear = new Date().getFullYear();
      const yearOptions = Array.from({ length: 51 }, (_, i) => currentYear - i);

      // Check if entry is active (has at least a title)
      const isActiveEntry = (entry: CareerHistoryEntry): boolean => {
        return !!(entry.title && entry.title.trim());
      };

      const activeFilledCount = careerHistoryValue.slice(0, MAX_ACTIVE_ROLES).filter(e => e.title?.trim()).length;

      const AddRoleButton = ({ position }: { position: 'top' | 'bottom' }) => (
        <button
          type="button"
          onClick={() => addCareerRow(position)}
          disabled={activeFilledCount >= MAX_ACTIVE_ROLES}
          className="w-full py-3 px-4 border-2 border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-500 hover:border-atlas-teal hover:text-atlas-teal hover:bg-atlas-teal/5 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add a role {activeFilledCount >= MAX_ACTIVE_ROLES ? '(5 max)' : `(${activeFilledCount}/5)`}
        </button>
      );

      return (
        <div>
          <div
            className="text-xl font-semibold mb-6"
            dangerouslySetInnerHTML={formatTextWithEmphasis(question.label)}
          />
          {renderDescription()}

          <div className="space-y-4">
            <AddRoleButton position="top" />

            {careerHistoryValue.map((entry, index) => {
              const isActive = isActiveEntry(entry);
              const isOverflow = index >= MAX_ACTIVE_ROLES;

              // Render divider just before first overflow entry
              const showDividerBefore = index === MAX_ACTIVE_ROLES;

              return (
                <React.Fragment key={index}>
                {showDividerBefore && (
                  <div className="flex items-center gap-3 pt-2">
                    <div className="flex-1 border-t border-gray-300" />
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Move up to include</span>
                    <div className="flex-1 border-t border-gray-300" />
                  </div>
                )}
                <div
                  className={`p-5 border-2 rounded-xl shadow-sm transition-all duration-200 ${
                    isOverflow
                      ? 'bg-gray-50 border-gray-200 opacity-50'
                      : isActive
                        ? 'bg-white border-atlas-teal/30'
                        : 'bg-white border-gray-200'
                  }`}
                >
                  {/* Role header with reorder + remove */}
                  <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      {/* Reorder arrows */}
                      <div className="flex flex-col -space-y-1 mr-1">
                        <button
                          type="button"
                          onClick={() => moveCareerRow(index, 'up')}
                          disabled={index === 0}
                          className="p-0.5 text-gray-400 hover:text-atlas-teal disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                          title="Move up"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => moveCareerRow(index, 'down')}
                          disabled={index === careerHistoryValue.length - 1}
                          className="p-0.5 text-gray-400 hover:text-atlas-teal disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                          title="Move down"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                      <span className={`text-base font-semibold ${isOverflow ? 'text-gray-400' : isActive ? 'text-atlas-navy' : 'text-gray-400'}`}>
                        {getRoleLabel(index, entry)}
                      </span>
                      {isActive && !isOverflow && (
                        <div className="text-green-600">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCareerRow(index)}
                      className="text-sm text-gray-400 hover:text-red-500 font-medium transition-colors"
                    >
                      Remove
                    </button>
                  </div>

                {/* Row 1: Job Title + Company Name */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isActive ? 'text-gray-700' : 'text-gray-400'}`}>Job Title</label>
                    <Input
                      value={entry.title}
                      onChange={(e) => updateCareerHistory(index, 'title', e.target.value)}
                      placeholder="e.g., Director of Marketing"
                      className={`w-full ${!isActive ? 'placeholder:text-gray-300' : ''} ${isActive && !entry.title?.trim() ? 'border-red-300 focus:border-red-400' : ''}`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isActive ? 'text-gray-700' : 'text-gray-400'}`}>Company Name</label>
                    <Input
                      value={entry.companyName}
                      onChange={(e) => updateCareerHistory(index, 'companyName', e.target.value)}
                      placeholder="e.g., Acme Legal AI"
                      className={`w-full ${!isActive ? 'placeholder:text-gray-300' : ''} ${isActive && !entry.companyName?.trim() ? 'border-red-300 focus:border-red-400' : ''}`}
                    />
                  </div>
                </div>

                {/* Row 2: Company Size + Company Culture */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isActive ? 'text-gray-700' : 'text-gray-400'}`}>Company Size</label>
                    <Select
                      value={entry.companySize || ''}
                      onValueChange={(val) => updateCareerHistory(index, 'companySize', val)}
                      required
                    >
                      <SelectTrigger className={`w-full ${!isActive ? 'text-gray-400' : ''} ${isActive && !entry.companySize ? 'border-red-300 focus:border-red-400' : ''}`}>
                        <SelectValue placeholder="Select size..." />
                      </SelectTrigger>
                      <SelectContent>
                        {COMPANY_SIZE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} textValue={opt.label}>
                            <div className="flex flex-col text-left">
                              <span>{opt.label}</span>
                              {opt.description && <span className="text-xs text-gray-500">{opt.description}</span>}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isActive ? 'text-gray-700' : 'text-gray-400'}`}>Company Culture</label>
                    <Select
                      value={entry.companyCulture || ''}
                      onValueChange={(val) => updateCareerHistory(index, 'companyCulture', val)}
                      required
                    >
                      <SelectTrigger className={`w-full ${!isActive ? 'text-gray-400' : ''} ${isActive && !entry.companyCulture ? 'border-red-300 focus:border-red-400' : ''}`}>
                        <SelectValue placeholder="Select culture..." />
                      </SelectTrigger>
                      <SelectContent>
                        {COMPANY_CULTURE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} textValue={opt.label}>
                            <div className="flex flex-col text-left">
                              <span>{opt.label}</span>
                              <span className="text-xs text-gray-500">{opt.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Row 3: Sector */}
                <div className="mb-4">
                  <label className={`block text-sm font-medium mb-1 ${isActive ? 'text-gray-700' : 'text-gray-400'}`}>Industry / Sector / Focus</label>
                  <Input
                    value={entry.sector}
                    onChange={(e) => updateCareerHistory(index, 'sector', e.target.value)}
                    placeholder="e.g., Legal Tech, FinTech, Healthcare"
                    className={`w-full ${!isActive ? 'placeholder:text-gray-300' : ''} ${isActive && !entry.sector?.trim() ? 'border-red-300 focus:border-red-400' : ''}`}
                  />
                </div>

                {/* Row 4: Start (Month + Year) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isActive ? 'text-gray-700' : 'text-gray-400'}`}>Start</label>
                    <div className="flex gap-2">
                      <Select
                        value={entry.startMonth || ''}
                        onValueChange={(val) => updateCareerHistory(index, 'startMonth', val)}
                      >
                        <SelectTrigger className={`w-full sm:w-24 ${!isActive ? 'text-gray-400' : ''}`}>
                          <SelectValue placeholder="Mon" />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTHS.map((month) => (
                            <SelectItem key={month.value} value={month.value}>
                              {month.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={entry.startYear?.toString() || ''}
                        onValueChange={(val) => updateCareerHistory(index, 'startYear', val ? parseInt(val) : '')}
                      >
                        <SelectTrigger className={`flex-1 ${!isActive ? 'text-gray-400' : ''} ${isActive && !entry.startYear ? 'border-red-300 focus:border-red-400' : ''}`}>
                          <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent>
                          {yearOptions.map((year) => (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isActive ? 'text-gray-700' : 'text-gray-400'}`}>End</label>
                    <div className="flex gap-2">
                      <Select
                        value={entry.endMonth || ''}
                        onValueChange={(val) => updateCareerHistory(index, 'endMonth', val)}
                        disabled={entry.isCurrent}
                      >
                        <SelectTrigger className={`w-full sm:w-24 ${entry.isCurrent ? 'opacity-50' : ''} ${!isActive ? 'text-gray-400' : ''}`}>
                          <SelectValue placeholder={entry.isCurrent ? 'Present' : 'Mon'} />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTHS.map((month) => (
                            <SelectItem key={month.value} value={month.value}>
                              {month.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={entry.endYear?.toString() || ''}
                        onValueChange={(val) => updateCareerHistory(index, 'endYear', val ? parseInt(val) : '')}
                        disabled={entry.isCurrent}
                      >
                        <SelectTrigger className={`flex-1 ${entry.isCurrent ? 'opacity-50' : ''} ${!isActive ? 'text-gray-400' : ''}`}>
                          <SelectValue placeholder={entry.isCurrent ? '' : 'Year'} />
                        </SelectTrigger>
                        <SelectContent>
                          {yearOptions.map((year) => (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Row 5: Current role checkbox + Duration */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id={`current-role-${index}`}
                      checked={entry.isCurrent || false}
                      onCheckedChange={(checked) => updateCareerHistory(index, 'isCurrent', checked as boolean)}
                      className="h-5 w-5"
                    />
                    <Label
                      htmlFor={`current-role-${index}`}
                      className={`text-sm font-medium cursor-pointer ${isActive ? 'text-gray-700' : 'text-gray-400'}`}
                    >
                      I currently work here
                    </Label>
                  </div>
                  {calculateDuration(entry) && (
                    <span className={`text-sm italic ${isActive ? 'text-gray-500' : 'text-gray-400'}`}>
                      {calculateDuration(entry)}
                    </span>
                  )}
                </div>
              </div>
              </React.Fragment>
              );
            })}

            <AddRoleButton position="bottom" />

            <p className="text-xs text-gray-500 mt-2 text-center">
              Up to 5 roles are included in your assessment. Use the arrows to reorder.
            </p>
          </div>
        </div>
      );

    case 'career_happiness':
      // Career happiness - shows roles from career_history question with happiness slider + optional reason
      const linkedQuestionId = question.config?.linkedQuestionId || '11111111-1111-1111-1111-111111111110';
      // Ensure careerHistoryData is always an array
      const rawCareerData = allResponses?.[linkedQuestionId];
      const careerHistoryData: CareerHistoryEntry[] = Array.isArray(rawCareerData) ? rawCareerData : [];

      // Filter to only show active roles (first 5 with a title)
      const validCareers = careerHistoryData.slice(0, 5).filter(c => c.title && c.title.trim() !== '');

      // Initialize happiness values if not set (ensure array)
      const happinessValue: CareerHappinessEntry[] = Array.isArray(value) ? value : validCareers.map(c => ({
        title: c.title,
        companyName: c.companyName || '',
        happiness: 5,
        reason: ''
      }));

      // Sync happiness entries with career history (in case careers were added/removed)
      // Match by title + companyName so duplicate titles (e.g. "Product Manager" at two companies) stay independent
      const syncedHappiness: CareerHappinessEntry[] = validCareers.map(career => {
        const existing = happinessValue.find(h =>
          h.title === career.title && (h.companyName || '') === (career.companyName || '')
        );
        return existing || { title: career.title, companyName: career.companyName || '', happiness: 5, reason: '' };
      });

      const updateHappiness = (index: number, field: 'happiness' | 'reason', fieldValue: number | string) => {
        const newHappiness = [...syncedHappiness];
        newHappiness[index] = { ...newHappiness[index], [field]: fieldValue };
        onChange(newHappiness);
      };

      if (validCareers.length === 0) {
        return (
          <div>
            <div
              className="text-xl font-semibold mb-6"
              dangerouslySetInnerHTML={formatTextWithEmphasis(question.label)}
            />
            {renderDescription()}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
              Please fill in your career history in the previous question first.
            </div>
          </div>
        );
      }

      return (
        <div>
          <div
            className="text-xl font-semibold mb-6"
            dangerouslySetInnerHTML={formatTextWithEmphasis(question.label)}
          />
          {renderDescription()}

          <div className="space-y-6">
            {syncedHappiness.map((entry, index) => (
              <div key={index} className="p-4 border rounded-lg bg-gray-50">
                <div className="mb-3">
                  <span className="text-sm font-medium text-gray-700">
                    {index === 0 ? 'Role 1 (most recent): ' : `Role ${index + 1}: `}
                  </span>
                  <span className="text-sm text-atlas-navy font-semibold">
                    {entry.title}{entry.companyName ? ` at ${entry.companyName}` : ''}
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-gray-500">Happiness (1-10)</label>
                      <span className="text-lg font-semibold text-atlas-navy">{entry.happiness}</span>
                    </div>
                    <Slider
                      value={[entry.happiness]}
                      onValueChange={(newValue) => updateHappiness(index, 'happiness', newValue[0])}
                      min={1}
                      max={10}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>1 (unhappy)</span>
                      <span>10 (very happy)</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs text-atlas-navy font-medium">
                        Why this score? <span className="text-red-500">*</span>
                      </label>
                      {(() => {
                        const reasonLen = (entry.reason || '').trim().length;
                        const under = reasonLen < CAREER_HAPPINESS_MIN_REASON_CHARS;
                        return (
                          <span className={`text-xs ${under ? 'text-amber-600' : 'text-green-600'}`}>
                            {reasonLen} / {CAREER_HAPPINESS_MIN_REASON_CHARS} min
                          </span>
                        );
                      })()}
                    </div>
                    <Input
                      value={entry.reason}
                      onChange={(e) => updateHappiness(index, 'reason', e.target.value)}
                      placeholder="e.g., Great autonomy, too many direct reports, unclear expectations..."
                      className="w-full text-sm bg-white placeholder:text-gray-300"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case 'skills_achievements': {
      // Skills, certifications, and achievements - extracted from LinkedIn/resume.
      // The CV provides up to 9 skills; the user just tags three of them as #1/#2/#3.
      // No reordering — display order preserves CV order, ranks are stored separately.
      const MAX_TOP_SKILLS = 3;
      const MAX_TOTAL_SKILLS = 9;
      const emptySkillsAchievements: SkillsAchievementsEntry = {
        topSkills: Array(MAX_TOTAL_SKILLS).fill(''),
        topSkillRanks: Array(MAX_TOTAL_SKILLS).fill(0),
        certifications: ['', '', ''],
        achievements: []
      };

      // Parse value - could be object or needs initialization
      // Handle both camelCase (frontend mapper) and snake_case (n8n direct) field names
      const rawSkills = value?.topSkills || value?.top_skills;
      const rawCerts = value?.certifications;
      const rawAchievements = value?.achievements;

      // Normalize achievements to CompanyAchievement[] format
      // Handles: CompanyAchievement[] (new format), [{text,company,year}] (n8n raw), string (legacy)
      let parsedAchievements: CompanyAchievement[] = [];
      if (Array.isArray(rawAchievements)) {
        if (rawAchievements.length > 0 && typeof rawAchievements[0] === 'object') {
          if ('yearRange' in rawAchievements[0]) {
            // Already in CompanyAchievement[] format (from previous save)
            parsedAchievements = rawAchievements;
          } else {
            // Raw n8n format: [{text, company, year}] — group by company name
            const grouped: Record<string, string[]> = {};
            rawAchievements.filter((a: any) => a?.text).forEach((a: any) => {
              const key = a.company || 'Other';
              if (!grouped[key]) grouped[key] = [];
              grouped[key].push(a.text);
            });
            parsedAchievements = Object.entries(grouped).map(([company, texts]) => ({
              company,
              yearRange: '',
              // Add bullet points when multiple achievements per company
              text: texts.length > 1
                ? texts.map(t => `• ${t}`).join('\n')
                : texts[0] || ''
            }));
          }
        }
      } else if (typeof rawAchievements === 'string' && rawAchievements.trim()) {
        // Legacy single-string format — place in "Other"
        parsedAchievements = [{ company: 'Other', yearRange: '', text: rawAchievements }];
      }

      // Pad topSkills to MAX_TOTAL_SKILLS so every slot renders. Legacy saved values of length 3
      // get padded out to 9 automatically.
      const padArray = (arr: string[] | undefined, length: number): string[] =>
        [...(Array.isArray(arr) ? arr : []), ...Array(length).fill('')].slice(0, length);

      const paddedSkills = value && typeof value === 'object'
        ? padArray(rawSkills, MAX_TOTAL_SKILLS)
        : Array(MAX_TOTAL_SKILLS).fill('');

      // topSkillRanks lives alongside topSkills. If the stored value doesn't have it yet
      // (first visit, or legacy data), default to ranking the first 3 non-empty skills
      // as 1/2/3 — matches the CV's own ordering.
      const rawRanks: any = value?.topSkillRanks;
      let paddedRanks: number[];
      if (Array.isArray(rawRanks) && rawRanks.length === MAX_TOTAL_SKILLS) {
        paddedRanks = rawRanks.map((r: any) => (r === 1 || r === 2 || r === 3 ? r : 0));
      } else {
        paddedRanks = Array(MAX_TOTAL_SKILLS).fill(0);
        let rank = 1;
        for (let i = 0; i < paddedSkills.length && rank <= MAX_TOP_SKILLS; i++) {
          if (paddedSkills[i] && paddedSkills[i].trim()) {
            paddedRanks[i] = rank++;
          }
        }
      }

      // Pull languages sub-object out of the existing value (may be missing).
      const rawLanguages = value?.languages;
      const parsedLanguages: LanguagesEntry =
        rawLanguages && typeof rawLanguages === 'object' && !Array.isArray(rawLanguages)
          ? {
              presets:
                rawLanguages.presets && typeof rawLanguages.presets === 'object'
                  ? rawLanguages.presets
                  : {},
              other:
                rawLanguages.other && typeof rawLanguages.other === 'object'
                  ? {
                      language: rawLanguages.other.language || '',
                      proficiency: rawLanguages.other.proficiency || '',
                    }
                  : null,
            }
          : { presets: {}, other: null };

      const skillsValue: SkillsAchievementsEntry = value && typeof value === 'object'
        ? {
            topSkills: paddedSkills,
            topSkillRanks: paddedRanks,
            certifications: padArray(rawCerts, 3),
            achievements: parsedAchievements,
            languages: parsedLanguages,
          }
        : { ...emptySkillsAchievements, languages: parsedLanguages };

      // Languages config (defaults guard against missing config so UI still renders).
      const DEFAULT_LANG_PROFICIENCY: Array<{ value: string; label: string }> = [
        { value: 'native', label: 'Native' },
        { value: 'fluent', label: 'Fluent' },
        { value: 'conversational', label: 'Conversational' },
        { value: 'basic', label: 'Basic' },
      ];
      const DEFAULT_LANG_PRESETS = [
        'English', 'Mandarin Chinese', 'Hindi', 'Spanish', 'French', 'Arabic', 'German',
      ];
      const langPresets: string[] = Array.isArray(question.config?.languages_presets)
        ? question.config.languages_presets
        : DEFAULT_LANG_PRESETS;
      const langOtherChoices: string[] = Array.isArray(question.config?.languages_other)
        ? question.config.languages_other
        : [];
      const langProficiencyLevels: Array<{ value: string; label: string }> =
        Array.isArray(question.config?.languages_proficiency_levels) &&
        question.config.languages_proficiency_levels.length > 0
          ? question.config.languages_proficiency_levels
          : DEFAULT_LANG_PROFICIENCY;

      const languagesValue: LanguagesEntry = skillsValue.languages || { presets: {}, other: null };

      const updateLanguages = (next: LanguagesEntry) => {
        onChange({ ...skillsValue, languages: next });
      };

      const togglePreset = (lang: string, checked: boolean) => {
        const nextPresets = { ...languagesValue.presets };
        if (checked) {
          if (!(lang in nextPresets)) nextPresets[lang] = '';
        } else {
          delete nextPresets[lang];
        }
        updateLanguages({ ...languagesValue, presets: nextPresets });
      };

      const setPresetProficiency = (lang: string, prof: string) => {
        updateLanguages({
          ...languagesValue,
          presets: { ...languagesValue.presets, [lang]: prof },
        });
      };

      const setOtherLanguage = (lang: string) => {
        updateLanguages({
          ...languagesValue,
          other: { language: lang, proficiency: languagesValue.other?.proficiency || '' },
        });
      };

      const setOtherProficiency = (prof: string) => {
        updateLanguages({
          ...languagesValue,
          other: { language: languagesValue.other?.language || '', proficiency: prof },
        });
      };

      const clearOther = () => {
        updateLanguages({ ...languagesValue, other: null });
      };

      const updateSkillsField = (field: 'topSkills' | 'certifications', index: number, newValue: string) => {
        const updated = { ...skillsValue };
        updated[field] = [...updated[field]];
        updated[field][index] = newValue;

        // If the user clears a skill that was ranked, drop its rank too.
        if (field === 'topSkills' && (!newValue || !newValue.trim())) {
          const ranks = [...(skillsValue.topSkillRanks || Array(MAX_TOTAL_SKILLS).fill(0))];
          ranks[index] = 0;
          updated.topSkillRanks = ranks;
        }
        onChange(updated);
      };

      // Toggle a rank (1, 2, or 3) on a skill. If the same button is clicked again,
      // the rank is cleared. Assigning a rank that's already held by another skill
      // steals it from that other skill (so each rank lives on at most one row).
      const toggleSkillRank = (index: number, rank: 1 | 2 | 3) => {
        const current = skillsValue.topSkillRanks || Array(MAX_TOTAL_SKILLS).fill(0);
        const next = [...current];
        if (next[index] === rank) {
          next[index] = 0;
        } else {
          for (let i = 0; i < next.length; i++) {
            if (next[i] === rank) next[i] = 0;
          }
          next[index] = rank;
        }
        onChange({ ...skillsValue, topSkillRanks: next });
      };

      // Update achievement text for a specific company box
      const updateCompanyAchievement = (companyName: string, yearRange: string, newText: string) => {
        const updatedAchievements = [...skillsValue.achievements];
        const existingIdx = updatedAchievements.findIndex(a => a.company === companyName);
        if (existingIdx >= 0) {
          updatedAchievements[existingIdx] = { ...updatedAchievements[existingIdx], text: newText };
        } else {
          updatedAchievements.push({ company: companyName, yearRange, text: newText });
        }
        onChange({ ...skillsValue, achievements: updatedAchievements });
      };

      return (
        <div>
          <div
            className="text-xl font-semibold mb-6"
            dangerouslySetInnerHTML={formatTextWithEmphasis(question.label)}
          />
          {renderDescription()}

          <div className="space-y-8">
            {/* Top Skills & Certifications Section */}
            <div className="p-5 border-2 rounded-xl bg-white shadow-sm">
              <h3 className="text-base font-semibold text-atlas-navy mb-4">Top Skills & Certifications</h3>

              {/* Flat list of all skills pulled from the CV. The user tags any three
                  as #1/#2/#3 — no reordering, no overflow distinction. */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Your Top 3 Skills</label>
                <p className="text-xs text-gray-500 mb-3">
                  Skills below are pulled from your CV. Tag your top three by clicking 1, 2, and 3.
                </p>
                <div className="space-y-2">
                  {Array.from({ length: MAX_TOTAL_SKILLS }).map((_, index) => {
                    const skillText = skillsValue.topSkills[index] || '';
                    const currentRank = skillsValue.topSkillRanks?.[index] || 0;
                    const isRanked = currentRank > 0;
                    const placeholder = index === 0
                      ? 'e.g., Strategic Planning'
                      : index === 1
                        ? 'e.g., Stakeholder Management'
                        : index === 2
                          ? 'e.g., Budget Administration'
                          : 'Additional skill';

                    return (
                      <div
                        key={`skill-${index}`}
                        className={`flex items-center gap-2 rounded-md transition-all duration-150 ${
                          isRanked
                            ? 'bg-atlas-teal/5 border border-atlas-teal/30 p-1.5'
                            : 'border border-transparent p-1.5'
                        }`}
                      >
                        <div className="flex items-center gap-1 flex-shrink-0" role="group" aria-label={`Rank skill ${index + 1}`}>
                          {[1, 2, 3].map((rank) => {
                            const isActive = currentRank === rank;
                            return (
                              <button
                                key={rank}
                                type="button"
                                onClick={() => toggleSkillRank(index, rank as 1 | 2 | 3)}
                                disabled={!skillText.trim() && !isActive}
                                aria-pressed={isActive}
                                title={isActive ? `Remove rank #${rank}` : `Set as #${rank}`}
                                className={`w-8 h-8 rounded-full text-xs font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                                  isActive
                                    ? 'bg-atlas-teal text-white ring-2 ring-atlas-teal/30'
                                    : 'bg-gray-100 text-gray-500 hover:bg-atlas-teal/10 hover:text-atlas-teal'
                                }`}
                              >
                                {rank}
                              </button>
                            );
                          })}
                        </div>
                        <Input
                          value={skillText}
                          onChange={(e) => updateSkillsField('topSkills', index, e.target.value)}
                          placeholder={placeholder}
                          className="flex-1"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Certifications - 3 fixed fields */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Certifications (optional)</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[0, 1, 2].map((index) => (
                    <Input
                      key={`cert-${index}`}
                      value={skillsValue.certifications[index] || ''}
                      onChange={(e) => updateSkillsField('certifications', index, e.target.value)}
                      placeholder={index === 0 ? 'e.g., Six Sigma Green Belt' : index === 1 ? 'e.g., Salesforce Certified' : ''}
                      className="w-full"
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Achievements Section — per-company textareas from career history */}
            <div className="p-5 border-2 rounded-xl bg-white shadow-sm">
              <h3 className="text-base font-semibold text-atlas-navy mb-2">Achievements</h3>
              <p className="text-sm text-gray-600 mb-4">
                Highlight key wins like revenue growth, cost savings, or successful team expansions.
              </p>

              {(() => {
                const careerQuestionId = '11111111-1111-1111-1111-111111111110';
                const rawCareers = allResponses?.[careerQuestionId];
                const careers: CareerHistoryEntry[] = Array.isArray(rawCareers) ? rawCareers : [];
                const filledCareers = careers.filter(c => c.companyName && c.companyName.trim() !== '');

                if (filledCareers.length === 0) {
                  // No career history yet — show a single general textarea
                  const generalText = skillsValue.achievements.find(a => a.company === 'Other')?.text ||
                                       skillsValue.achievements[0]?.text || '';
                  return (
                    <div>
                      <p className="text-xs text-gray-400 italic mb-3">
                        Tip: fill in your career history first to get separate achievement fields per company.
                      </p>
                      <textarea
                        value={generalText}
                        onChange={(e) => updateCompanyAchievement('Other', '', e.target.value)}
                        className="w-full rounded-md border border-gray-300 bg-[#ffffff] text-[#111827] px-3 py-2 text-sm leading-relaxed resize-y min-h-[120px]"
                        rows={4}
                        placeholder="Describe your key achievements..."
                      />
                    </div>
                  );
                }

                // Per-company achievement textareas
                return (
                  <div className="space-y-4">
                    {filledCareers.map((career, idx) => {
                      const yearRange = career.startYear
                        ? career.isCurrent
                          ? `${career.startYear}–Present`
                          : career.endYear
                            ? `${career.startYear}–${career.endYear}`
                            : `${career.startYear}`
                        : '';
                      const label = yearRange
                        ? `${career.companyName} (${yearRange})`
                        : career.companyName;

                      // Find matching achievement — try exact match, then case-insensitive
                      const match = skillsValue.achievements.find(a =>
                        a.company === career.companyName
                      ) || skillsValue.achievements.find(a =>
                        a.company.toLowerCase() === career.companyName.toLowerCase()
                      );

                      return (
                        <div key={`achievement-${career.companyName}-${idx}`}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="w-1 h-4 bg-atlas-teal rounded-full" />
                            <label className="text-sm font-medium text-gray-700">{label}</label>
                          </div>
                          <textarea
                            value={match?.text || ''}
                            onChange={(e) => updateCompanyAchievement(career.companyName, yearRange, e.target.value)}
                            className="w-full rounded-md border border-gray-300 bg-[#ffffff] text-[#111827] px-3 py-2 text-sm leading-relaxed resize-y min-h-[80px]"
                            rows={3}
                            placeholder={`Key achievements at ${career.companyName}...`}
                          />
                        </div>
                      );
                    })}

                    {/* Other / General achievements */}
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-1 h-4 bg-gray-300 rounded-full" />
                        <label className="text-sm font-medium text-gray-500">Other Achievements (optional)</label>
                      </div>
                      <AutoResizeTextarea
                        value={skillsValue.achievements.find(a => a.company === 'Other')?.text || ''}
                        onChange={(e) => updateCompanyAchievement('Other', '', e.target.value)}
                        className="w-full rounded-md border border-gray-300 bg-[#ffffff] text-[#111827] px-3 py-2 text-sm leading-relaxed"
                        minHeightPx={60}
                        placeholder="Any other achievements not tied to a specific company..."
                      />
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Languages Section — required, at least one language with proficiency */}
            <div className="p-5 border-2 rounded-xl bg-white shadow-sm">
              <h3 className="text-base font-semibold text-atlas-navy mb-1">
                Languages <span className="text-red-500">*</span>
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Which languages do you speak, and how well? Select at least one.
              </p>

              <div className="space-y-3">
                {langPresets.map((lang) => {
                  const isChecked = lang in languagesValue.presets;
                  const prof = languagesValue.presets[lang] || '';
                  return (
                    <div
                      key={lang}
                      className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border transition-all ${
                        isChecked
                          ? 'border-atlas-teal bg-atlas-teal/5'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <label className="flex items-center gap-3 flex-1 cursor-pointer">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(c) => togglePreset(lang, !!c)}
                        />
                        <span className="text-base font-medium text-gray-800">{question.langLabels?.presets?.[lang] ?? lang}</span>
                      </label>
                      {isChecked && (
                        <Select
                          value={prof}
                          onValueChange={(v) => setPresetProficiency(lang, v)}
                        >
                          <SelectTrigger className="w-full sm:w-48">
                            <SelectValue placeholder="Proficiency..." />
                          </SelectTrigger>
                          <SelectContent>
                            {langProficiencyLevels.map((p) => (
                              <SelectItem key={p.value} value={p.value}>
                                {question.langLabels?.proficiency?.[p.label] ?? p.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  );
                })}

                {/* Other language picker */}
                <div className="p-3 rounded-lg border border-dashed border-gray-300 bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">
                      Another language (optional)
                    </label>
                    {languagesValue.other &&
                      (languagesValue.other.language || languagesValue.other.proficiency) && (
                        <button
                          type="button"
                          onClick={clearOther}
                          className="text-xs text-gray-500 hover:text-red-500"
                        >
                          Clear
                        </button>
                      )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Select
                      value={languagesValue.other?.language || ''}
                      onValueChange={setOtherLanguage}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Choose a language..." />
                      </SelectTrigger>
                      <SelectContent>
                        {langOtherChoices.map((lang) => (
                          <SelectItem key={lang} value={lang}>
                            {question.langLabels?.other?.[lang] ?? lang}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {languagesValue.other?.language && (
                      <Select
                        value={languagesValue.other?.proficiency || ''}
                        onValueChange={setOtherProficiency}
                      >
                        <SelectTrigger className="w-full sm:w-48">
                          <SelectValue placeholder="Proficiency..." />
                        </SelectTrigger>
                        <SelectContent>
                          {langProficiencyLevels.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              {question.langLabels?.proficiency?.[p.label] ?? p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    case 'interests_hobbies':
      // Interests/Hobbies - 3 separate input fields with 50 character max
      const emptyInterests: InterestsEntry = {
        interests: ['', '', '']
      };

      // Parse value - could be array, object, or string (legacy)
      let interestsValue: InterestsEntry;
      if (Array.isArray(value)) {
        interestsValue = { interests: [...value, '', '', ''].slice(0, 3) };
      } else if (value && typeof value === 'object' && value.interests) {
        interestsValue = { interests: [...value.interests, '', '', ''].slice(0, 3) };
      } else if (typeof value === 'string' && value) {
        // Legacy: convert comma-separated string to array
        const parsed = value.split(',').map(s => s.trim()).filter(s => s);
        interestsValue = { interests: [...parsed, '', '', ''].slice(0, 3) };
      } else {
        interestsValue = { ...emptyInterests };
      }

      const updateInterest = (index: number, newValue: string) => {
        const updated = [...interestsValue.interests];
        updated[index] = newValue.slice(0, 50); // Enforce 50 char limit
        onChange({ interests: updated });
      };

      return (
        <div>
          <div
            className="text-xl font-semibold mb-6"
            dangerouslySetInnerHTML={formatTextWithEmphasis(question.label)}
          />
          {renderDescription()}

          <div className="space-y-3">
            {[0, 1, 2].map((index) => (
              <div key={`interest-${index}`}>
                <Input
                  value={interestsValue.interests[index] || ''}
                  onChange={(e) => updateInterest(index, e.target.value)}
                  placeholder={index === 0 ? 'e.g., Gardening' : index === 1 ? 'e.g., Creative writing' : 'e.g., Lego'}
                  maxLength={50}
                  className="w-full"
                />
                <p className="text-xs text-gray-400 mt-1 text-right">
                  {(interestsValue.interests[index] || '').length}/50
                </p>
              </div>
            ))}
          </div>
        </div>
      );

    default:
      return (
        <div>
          <div
            className="text-xl font-semibold mb-6"
            dangerouslySetInnerHTML={formatTextWithEmphasis(question.label)}
          />
          {renderDescription()}
          <p className="text-red-500">Unsupported question type: {question.type}</p>
        </div>
      );
  }
};

// Separate component for long_text so the voice hook is called unconditionally
const LongTextWithVoice: React.FC<{
  question: Question;
  value: any;
  onChange: (value: any) => void;
  formatTextWithEmphasis: (text: string) => { __html: string };
  renderDescription: () => React.ReactNode;
}> = ({ question, value, onChange, formatTextWithEmphasis, renderDescription }) => {
  const { isListening, isCleaning, isSupported, toggleListening } = useSpeechRecognition({
    onTranscript: onChange,
    existingText: value || '',
    cleanOnStop: true,
  });

  return (
    <div>
      <div
        className="text-xl font-semibold mb-6"
        dangerouslySetInnerHTML={formatTextWithEmphasis(question.label)}
      />
      {renderDescription()}
      <div className="relative">
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter your response..."
          disabled={isCleaning}
          className="w-full rounded-md border border-gray-300 bg-[#ffffff] text-[#111827] px-3 py-2 pr-12 text-base leading-relaxed resize-y min-h-[350px] disabled:opacity-70"
          rows={10}
          maxLength={question.config?.max_length}
        />
        {isSupported && (
          <button
            type="button"
            onClick={toggleListening}
            disabled={isCleaning}
            title={isListening ? 'Stop recording' : 'Voice input'}
            className={`absolute bottom-3 right-3 flex items-center justify-center w-9 h-9 rounded-md transition-colors ${
              isListening
                ? 'text-red-500 bg-red-50 animate-mic-pulse'
                : 'text-gray-400 hover:text-atlas-teal hover:bg-atlas-teal/5'
            } ${isCleaning ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isCleaning ? <Loader2 size={18} className="animate-spin" /> : <Mic size={18} />}
          </button>
        )}
      </div>
      {isCleaning && (
        <p className="text-sm text-atlas-teal mt-2 flex items-center gap-1.5">
          <Loader2 size={14} className="animate-spin" />
          Tidying up your transcript...
        </p>
      )}
      {question.config?.max_length && (
        <p className="text-sm text-gray-500 mt-2">
          {(value || '').length} / {question.config.max_length} characters
        </p>
      )}
    </div>
  );
};