import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckCircle, ImagePlus, X } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const ENDPOINT = `${SUPABASE_URL}/functions/v1/submit-support-request`;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Screenshot upload constraints — kept in sync with the edge function's checks.
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

// Read a File into a base64 data URL ("data:image/png;base64,...").
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export const SUPPORT_CATEGORIES: { value: string; label: string }[] = [
  { value: 'access_code_payment', label: 'Access code / payment' },
  { value: 'assessment_survey', label: 'Assessment / survey' },
  { value: 'ai_chat', label: 'AI Chat' },
  { value: 'my_report', label: 'My report' },
  { value: 'job_openings', label: 'Job openings' },
  { value: 'account_login', label: 'Account / login' },
  { value: 'feature_idea', label: 'Feature idea' },
  { value: 'bug_report', label: 'Bug report' },
  { value: 'something_else', label: 'Something else' },
];

// Pull the access code from the URL or from purchase_data in localStorage,
// so support tickets carry it automatically when the user is in a flow.
function readAccessCode(): string | null {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('code');
    if (fromUrl) return fromUrl;
    const stored = localStorage.getItem('purchase_data');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.accessCode) return String(parsed.accessCode);
    }
  } catch {
    // ignore — access code is optional context
  }
  return null;
}

// Best-guess default category from the page support was opened on. Page-level
// granularity only — the user can still change it. Returns '' (no default) for
// pages where the topic is genuinely ambiguous.
function defaultCategoryForPath(pathname: string): string {
  if (pathname.startsWith('/assessment')) return 'assessment_survey';
  if (pathname.startsWith('/chat')) return 'ai_chat';
  if (pathname.startsWith('/jobs')) return 'job_openings';
  if (pathname.startsWith('/report')) return 'my_report';
  if (pathname.startsWith('/payment')) return 'access_code_payment';
  if (pathname.startsWith('/profile')) return 'account_login';
  if (
    pathname.startsWith('/auth') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password')
  ) {
    return 'account_login';
  }
  return '';
}

interface SupportFormProps {
  onSuccess?: () => void;
}

const SupportForm = ({ onSuccess }: SupportFormProps) => {
  const { user } = useAuth();
  const location = useLocation();
  const { t } = useTranslation('support');

  const [category, setCategory] = useState(() =>
    defaultCategoryForPath(location.pathname),
  );
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [screenshot, setScreenshot] = useState<{ dataUrl: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLoggedIn = !!user;
  const isBug = category === 'bug_report';

  const handleScreenshotChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('');
    const file = e.target.files?.[0];
    // Reset the input so picking the same file again still fires onChange.
    e.target.value = '';
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setErrorMsg(t('validation.screenshotType'));
      return;
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      setErrorMsg(t('validation.screenshotSize'));
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setScreenshot({ dataUrl, name: file.name });
    } catch {
      setErrorMsg(t('validation.screenshotType'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!category) {
      setErrorMsg(t('validation.category'));
      return;
    }
    if (message.trim().length === 0) {
      setErrorMsg(t('validation.message'));
      return;
    }
    if (!isLoggedIn && !EMAIL_RE.test(email.trim())) {
      setErrorMsg(t('validation.email'));
      return;
    }

    setStatus('submitting');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? SUPABASE_ANON_KEY;

      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          category,
          message: message.trim(),
          email: isLoggedIn ? undefined : email.trim(),
          page: location.pathname,
          access_code: readAccessCode(),
          user_agent: navigator.userAgent,
          screenshot: screenshot?.dataUrl,
          screenshot_name: screenshot?.name,
        }),
      });

      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }
      setStatus('success');
      onSuccess?.();
    } catch {
      setStatus('error');
      setErrorMsg(t('validation.submitError'));
    }
  };

  if (status === 'success') {
    return (
      <div className="text-center py-6">
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-7 w-7 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold mb-1">{t('form.successTitle')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('form.successBody')}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="support-category">{t('form.categoryLabel')}</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger id="support-category" className="mt-1.5">
            <SelectValue placeholder={t('form.categoryPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {SUPPORT_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {t(`categories.${c.value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!isLoggedIn && (
        <div>
          <Label htmlFor="support-email">{t('form.emailLabel')}</Label>
          <Input
            id="support-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('form.emailPlaceholder')}
            className="mt-1.5"
          />
        </div>
      )}

      <div>
        <Label htmlFor="support-message">{t('form.messageLabel')}</Label>
        <Textarea
          id="support-message"
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 5000))}
          placeholder={isBug ? t('form.messagePlaceholderBug') : t('form.messagePlaceholder')}
          rows={5}
          className="mt-1.5"
        />
      </div>

      <div>
        <Label>{t('form.screenshotLabel')}</Label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleScreenshotChange}
          className="hidden"
        />
        {screenshot ? (
          <div className="mt-1.5 flex items-center gap-3 rounded-md border border-input bg-muted/40 p-2">
            <img
              src={screenshot.dataUrl}
              alt={screenshot.name}
              className="h-12 w-12 rounded object-cover border border-input"
            />
            <span className="flex-1 truncate text-sm text-muted-foreground">{screenshot.name}</span>
            <button
              type="button"
              onClick={() => setScreenshot(null)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label={t('form.screenshotRemove')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-input bg-muted/20 px-3 py-3 text-sm text-muted-foreground transition-colors hover:border-atlas-teal hover:text-atlas-teal"
          >
            <ImagePlus className="h-4 w-4" />
            {t('form.screenshotAdd')}
          </button>
        )}
        <p className="mt-1 text-xs text-muted-foreground">{t('form.screenshotHint')}</p>
      </div>

      {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}

      <Button type="submit" className="w-full" disabled={status === 'submitting'}>
        {status === 'submitting' ? t('form.submitting') : t('form.submit')}
      </Button>
    </form>
  );
};

export default SupportForm;
