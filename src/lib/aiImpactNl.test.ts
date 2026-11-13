import { describe, it, expect, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/i18n', () => ({ default: {} }));
import { extractAIImpact, leadingAIImpactLevel } from '@/components/chat/CareerScoreCard';
import { localizeAIImpactLabel, sectionText } from '@/lib/sectionText';

describe('Encore Dutch AI-impact', () => {
  it('reads the label under the Dutch heading', () => {
    expect(extractAIImpact('tie.\n\n<h5>AI-impact op deze rol</h5>\n\nMinimal. De kern')).toBe('Minimal');
    expect(extractAIImpact('<h5>AI-impact op deze rol</h5>\n**Moderate.** AI-tools')).toBe('Moderate');
    expect(extractAIImpact('<h5>AI-impact op deze rol</h5>\nGemiddeld. AI-tools')).toBe('Moderate');
  });
  it('shows the Dutch label in Dutch, English stays English', () => {
    expect(localizeAIImpactLabel('<h5>AI-impact op deze rol</h5>\n**Moderate.** AI', 'nl')).toBe('<h5>AI-impact op deze rol</h5>\n**Gemiddeld.** AI');
    expect(localizeAIImpactLabel('<h5>AI-impact op deze rol</h5>\n\nMinimal. De kern', 'nl')).toBe('<h5>AI-impact op deze rol</h5>\n\nMinimaal. De kern');
    expect(localizeAIImpactLabel('How AI will impact this role\nMinimal.', 'en')).toBe('How AI will impact this role\nMinimal.');
    expect(sectionText({ content: '<h5>AI-impact op deze rol</h5>\nHigh. x' }, 'nl')).toContain('Hoog. x');
  });
  it('leading label works in Dutch', () => {
    expect(leadingAIImpactLevel('**Gemiddeld.** AI-tools')).toBe('Moderate');
    expect(leadingAIImpactLevel('Hoog. Veel werk')).toBe('High');
  });
});
