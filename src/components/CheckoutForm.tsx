import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { getStoredReferralCode } from '@/lib/referral';
import i18n from '@/i18n';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Lock } from "lucide-react";

// Schema is built with the translation fn so validation messages are localized.
const buildFormSchema = (t: (key: string) => string) =>
  z.object({
    firstName: z.string().min(2, { message: t('validation.firstName') }),
    lastName: z.string().min(2, { message: t('validation.lastName') }),
    email: z.string().email({ message: t('validation.email') }),
    country: z.string().min(2, { message: t('validation.country') }),
    businessName: z.string().optional(),
    vatNumber: z.string().optional(),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: t('validation.acceptTerms') }),
    }),
  });

type CheckoutFormValues = z.infer<ReturnType<typeof buildFormSchema>>;

// Common countries list
const countries = [
  "Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czech Republic", 
  "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", 
  "Hungary", "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg", 
  "Malta", "Netherlands", "Poland", "Portugal", "Romania", "Slovakia", 
  "Slovenia", "Spain", "Sweden", "United Kingdom", "United States", 
  "Canada", "Australia", "New Zealand", "Japan", "China", "India"
];

// Helper function to extract names from OAuth metadata
function extractUserNames(user: any, profile: any) {
  // Try to get first and last name from various OAuth provider fields
  let firstName = '';
  let lastName = '';
  
  // Priority order for first name
  if (profile?.first_name) {
    firstName = profile.first_name;
  } else if (user?.user_metadata?.given_name) {
    firstName = user.user_metadata.given_name;
  } else if (user?.user_metadata?.first_name) {
    firstName = user.user_metadata.first_name;
  } else if (user?.user_metadata?.name) {
    // For LinkedIn, sometimes the full name is in 'name' field
    firstName = user.user_metadata.name.split(' ')[0] || '';
  } else if (user?.user_metadata?.full_name) {
    firstName = user.user_metadata.full_name.split(' ')[0] || '';
  } else if (user?.user_metadata?.displayName) {
    firstName = user.user_metadata.displayName.split(' ')[0] || '';
  }
  
  // Priority order for last name
  if (profile?.last_name) {
    lastName = profile.last_name;
  } else if (user?.user_metadata?.family_name) {
    lastName = user.user_metadata.family_name;
  } else if (user?.user_metadata?.last_name) {
    lastName = user.user_metadata.last_name;
  } else if (user?.user_metadata?.name) {
    // For LinkedIn, extract last name from full name
    const nameParts = user.user_metadata.name.split(' ');
    lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
  } else if (user?.user_metadata?.full_name) {
    const nameParts = user.user_metadata.full_name.split(' ');
    lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
  } else if (user?.user_metadata?.displayName) {
    const nameParts = user.user_metadata.displayName.split(' ');
    lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
  }
  
  return { firstName: firstName.trim(), lastName: lastName.trim() };
}

// Helper function to extract email
function extractUserEmail(user: any, profile: any) {
  return user?.email || 
         profile?.email || 
         user?.user_metadata?.email || 
         user?.user_metadata?.email_address || 
         '';
}

interface CheckoutFormProps {
  /**
   * Product flavor being purchased. 'starter' and 'encore' make
   * payment-success mint an access code for that flavor's survey (and
   * create-checkout charge that flavor's price); default is the professional
   * assessment. Threaded via Stripe session metadata.
   */
  flavor?: 'pro' | 'starter' | 'encore';
}

export function CheckoutForm({ flavor = 'pro' }: CheckoutFormProps = {}) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { t } = useTranslation('payment');
  const formSchema = useMemo(() => buildFormSchema(t), [t]);

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      country: '',
      businessName: '',
      vatNumber: '',
      acceptTerms: undefined as unknown as true,
    },
  });

  // Effect to update form values when user or profile changes
  useEffect(() => {
    if (user || profile) {
      const { firstName, lastName } = extractUserNames(user, profile);
      const email = extractUserEmail(user, profile);
      const country = profile?.country || '';
      
      // Only update if the field is currently empty or if it's the default value
      // This preserves user edits while updating on login/logout
      const currentValues = form.getValues();
      
      const updates: Partial<CheckoutFormValues> = {};
      
      if (firstName && (!currentValues.firstName || currentValues.firstName === '')) {
        updates.firstName = firstName;
      }
      
      if (lastName && (!currentValues.lastName || currentValues.lastName === '')) {
        updates.lastName = lastName;
      }
      
      if (email && (!currentValues.email || currentValues.email === '')) {
        updates.email = email;
      }
      
      if (country && (!currentValues.country || currentValues.country === '')) {
        updates.country = country;
      }
      
      // Apply updates if any
      if (Object.keys(updates).length > 0) {
        form.reset({
          ...currentValues,
          ...updates,
        });
      }
    }
  }, [user, profile, form]);

  async function onSubmit(values: CheckoutFormValues) {
    setIsLoading(true);
    setError(null);

    try {
      // Store country in localStorage for profile update after payment/signup
      localStorage.setItem('payment_country', values.country);

      // Record consent timestamp for GDPR compliance
      if (user) {
        const consentTimestamp = new Date().toISOString();
        await supabase.from('profiles').update({
          privacy_consent_at: consentTimestamp,
          terms_consent_at: consentTimestamp,
        } as any).eq('id', user.id);
      }

      const { data, error: apiError } = await supabase.functions.invoke("create-checkout", {
        body: {
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          country: values.country,
          businessName: values.businessName,
          vatNumber: values.vatNumber,
          // Pre-applies the 25% referral discount if the visitor arrived via
          // a ?ref= link.
          referralCode: getStoredReferralCode(),
          // UI language the buyer is checking out in — threaded into the Stripe
          // session metadata so payment-success can send the receipt email in
          // the right language (the buyer may have no profile yet).
          preferredLanguage: i18n.language || 'en',
          // Product flavor — 'starter' access codes load the starter survey.
          flavor,
        },
      });

      if (apiError) {
        console.error("API error:", apiError);
        throw new Error(apiError.message);
      }

      if (!data) {
        throw new Error("No data returned from API");
      }

      if (data?.url) {
        // Mark THIS device/browser as the one that started checkout. When a
        // buyer confirms payment on their phone bank app after starting on a
        // computer, the phone lands on /payment-success WITHOUT this flag, so
        // we can show a "go back to your other device" message there instead
        // of the signup CTA. localStorage is per-browser, so the phone won't
        // have it unless the buyer also started on the phone.
        localStorage.setItem('checkout_initiated_here', '1');
        // Redirect to Stripe checkout
        window.location.href = data.url;
      } else {
        throw new Error("Failed to create checkout session: No URL returned");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      const errorMessage = error instanceof Error ? error.message : t('errors.generic');

      // Show a more detailed error for common issues
      if (errorMessage.includes("Invalid API Key")) {
        setError(t('errors.notConfigured'));
      } else if (errorMessage.includes("account") && errorMessage.includes("active")) {
        setError(t('errors.notActivated'));
      } else {
        setError(errorMessage);
      }

      toast({
        title: t('errors.title'),
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  const inputCls =
    'bg-[#FFFDF5] border-[rgba(201,182,144,0.8)] text-[#122E3B] placeholder:text-[#9CA3AF] focus-visible:ring-atlas-teal/40';
  const labelCls = 'text-[13px] font-semibold text-[#122E3B]';
  const optionalCls = 'text-[11px] font-medium text-[#6B7F8B] ml-1';

  return (
    <div>
      {/* Section eyebrow */}
      <div className="mb-4">
        <span
          className="font-heading uppercase text-[11px]"
          style={{ color: '#C8891A', letterSpacing: '0.24em', fontWeight: 700 }}
        >
          {t('form.eyebrow')}
        </span>
        <p className="text-[13px] font-medium mt-2 leading-snug" style={{ color: '#4B6373' }}>
          {t('form.intro')}
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={labelCls}>{t('form.firstName')}</FormLabel>
                  <FormControl>
                    <Input placeholder="Claire" className={inputCls} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={labelCls}>{t('form.lastName')}</FormLabel>
                  <FormControl>
                    <Input placeholder="Ritty" className={inputCls} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={labelCls}>{t('form.email')}</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="claire.ritty@email.com" className={inputCls} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="country"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={labelCls}>{t('form.country')}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className={inputCls}>
                      <SelectValue placeholder={t('form.countryPlaceholder')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {countries.map((country) => (
                      <SelectItem key={country} value={country}>
                        {country}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="businessName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={labelCls}>
                    {t('form.businessName')} <span className={optionalCls}>{t('form.optional')}</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Atlas Solutions BV" className={inputCls} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="vatNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={labelCls}>
                    {t('form.vatNumber')} <span className={optionalCls}>{t('form.optional')}</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="NL123456789B01" className={inputCls} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="acceptTerms"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-1">
                <FormControl>
                  <Checkbox
                    checked={field.value === true}
                    onCheckedChange={(checked) => field.onChange(checked === true ? true : undefined)}
                    className="border-atlas-teal/60 data-[state=checked]:bg-atlas-teal data-[state=checked]:border-atlas-teal"
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel
                    className="text-[13px] font-medium leading-snug"
                    style={{ color: '#4B6373' }}
                  >
                    {t('form.agreePrefix')}{' '}
                    <a
                      href="/privacy-policy"
                      target="_blank"
                      className="underline hover:opacity-80"
                      style={{ color: '#1F8282' }}
                    >
                      {t('form.privacyPolicy')}
                    </a>{' '}
                    {t('form.and')}{' '}
                    <a
                      href="/terms-conditions"
                      target="_blank"
                      className="underline hover:opacity-80"
                      style={{ color: '#1F8282' }}
                    >
                      {t('form.termsOfService')}
                    </a>
                  </FormLabel>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />

          {error && (
            <div className="text-destructive text-sm p-3 bg-destructive/10 rounded-md">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-full bg-atlas-teal text-white hover:bg-atlas-teal/90 font-bold text-[14.5px] py-[13px] shadow-[0_10px_24px_-8px_rgba(39,161,161,0.55)]"
          >
            {isLoading ? t('form.submitting') : t('form.submit')}
          </Button>

          {/* Footer microcopy */}
          <div
            className="mt-4 pt-4 space-y-1.5 text-center"
            style={{ borderTop: '1px solid rgba(201,182,144,0.5)' }}
          >
            <p
              className="text-[11.5px] font-medium leading-snug inline-flex items-center justify-center gap-1.5"
              style={{ color: '#6B7F8B' }}
            >
              <Lock className="h-3 w-3" />
              {t('form.secureNote')}
            </p>
            <p
              className="text-[11.5px] font-medium leading-snug"
              style={{ color: '#6B7F8B' }}
            >
              {t('form.dataNote')}
            </p>
          </div>
        </form>
      </Form>
    </div>
  );
}