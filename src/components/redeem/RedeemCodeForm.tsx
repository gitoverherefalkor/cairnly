import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { normaliseAccessCode, signupPathForCode } from '@/lib/redeemCode';
import { claimPendingCode } from '@/lib/claimAccessCode';

interface RedeemCodeFormProps {
  /**
   * 'collapsed': a small "Already have an access code?" link that opens the
   * field (on /auth and the checkout pages). 'open': the field straight away
   * (the /redeem page).
   */
  variant?: 'collapsed' | 'open';
  initialCode?: string;
}

/**
 * Lets someone who already holds an access code (from an employer, a partner
 * or a gift) use it without a link that carries ?code=. The code is checked
 * with verify-access-code; a valid one continues into the existing code-link
 * signup (/auth?flow=signup&code=…), so email and Google/LinkedIn signup work
 * exactly as they do for partner links. A visitor who is already signed in
 * gets the code added to their account instead.
 */
const RedeemCodeForm = ({ variant = 'collapsed', initialCode = '' }: RedeemCodeFormProps) => {
  const { t, i18n } = useTranslation('auth');
  const navigate = useNavigate();
  const { toast } = useToast();
  const [open, setOpen] = useState(variant === 'open');
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const lang = String(i18n.language ?? 'en').slice(0, 2).toLowerCase() === 'nl' ? 'nl' : 'en';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalised = normaliseAccessCode(code);
    if (!normalised) {
      setError(t('redeem.empty'));
      return;
    }
    setChecking(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();

      // Already signed in: bind the code to this account, then the dashboard.
      if (session) {
        const claimError = await claimPendingCode({ code: normalised, lang }, session.access_token);
        if (claimError) {
          setError(claimError);
          return;
        }
        toast({ title: t('redeem.addedTitle'), description: t('redeem.addedBody') });
        navigate('/dashboard');
        return;
      }

      const { data, error: fnError } = await supabase.functions.invoke('verify-access-code', {
        body: { code: normalised, lang },
      });
      if (fnError || !data?.valid) {
        setError((data?.error as string | undefined) ?? t('redeem.failed'));
        return;
      }
      navigate(signupPathForCode(data.accessCode?.code ?? normalised, lang));
    } catch (err) {
      console.error('Redeeming the access code failed:', err);
      setError(t('redeem.failed'));
    } finally {
      setChecking(false);
    }
  };

  if (!open) {
    return (
      <div className="text-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold underline-offset-2 hover:underline"
          style={{ color: '#1F8282' }}
        >
          <KeyRound className="h-3.5 w-3.5" />
          {t('redeem.link')}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label htmlFor="redeem-code" className="block text-[13px] font-semibold text-[#122E3B]">
        {t('redeem.label')}
      </label>
      {/* The /redeem page says this in its subtitle already. */}
      {variant === 'collapsed' && (
        <p className="text-[12px] font-medium leading-snug" style={{ color: '#6B7F8B' }}>
          {t('redeem.hint')}
        </p>
      )}
      <div className="flex gap-2">
        <Input
          id="redeem-code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError('');
          }}
          autoFocus={variant === 'collapsed'}
          autoComplete="off"
          spellCheck={false}
          placeholder="XXXX-XXXX-XXXX-XXXX"
          className="uppercase bg-[#FFFDF5] border-[rgba(201,182,144,0.8)] text-[#122E3B] placeholder:normal-case placeholder:text-[#9CA3AF] focus-visible:ring-atlas-teal/40"
        />
        <Button
          type="submit"
          disabled={checking}
          className="rounded-full bg-atlas-teal text-white hover:bg-atlas-teal/90 font-bold px-5 shrink-0"
        >
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : t('redeem.submit')}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-[13px]" style={{ color: '#991B1B' }}>
          {error}
        </p>
      )}
    </form>
  );
};

export default RedeemCodeForm;
