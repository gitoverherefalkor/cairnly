import React, { useState, useEffect } from 'react';
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { getStoredReferralCode } from '@/lib/referral';

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

const formSchema = z.object({
  firstName: z.string().min(2, {
    message: "First name must be at least 2 characters.",
  }),
  lastName: z.string().min(2, {
    message: "Last name must be at least 2 characters.",
  }),
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  country: z.string().min(2, {
    message: "Please select a country.",
  }),
  businessName: z.string().optional(),
  vatNumber: z.string().optional(),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the Privacy Policy and Terms of Service." }),
  }),
});

type CheckoutFormValues = z.infer<typeof formSchema>;

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

export function CheckoutForm() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
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
        // Redirect to Stripe checkout
        window.location.href = data.url;
      } else {
        throw new Error("Failed to create checkout session: No URL returned");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
      
      // Show a more detailed error for common issues
      if (errorMessage.includes("Invalid API Key")) {
        setError("Payment system is not properly configured. Please try again later or contact support.");
      } else if (errorMessage.includes("account") && errorMessage.includes("active")) {
        setError("Payment system is not activated yet. Please try again later.");
      } else {
        setError(errorMessage);
      }
      
      toast({
        title: "Checkout Failed",
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
          Your Information
        </span>
        <p className="text-[13px] font-medium mt-2 leading-snug" style={{ color: '#4B6373' }}>
          Please fill in your details below. Business customers can enter their company info for invoicing.
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
                  <FormLabel className={labelCls}>First Name</FormLabel>
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
                  <FormLabel className={labelCls}>Last Name</FormLabel>
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
                <FormLabel className={labelCls}>Email</FormLabel>
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
                <FormLabel className={labelCls}>Country</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className={inputCls}>
                      <SelectValue placeholder="Select a country" />
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
                    Business Name <span className={optionalCls}>(optional)</span>
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
                    VAT Number <span className={optionalCls}>(optional)</span>
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
                    I agree to the{' '}
                    <a
                      href="/privacy-policy"
                      target="_blank"
                      className="underline hover:opacity-80"
                      style={{ color: '#1F8282' }}
                    >
                      Privacy Policy
                    </a>{' '}
                    and{' '}
                    <a
                      href="/terms-conditions"
                      target="_blank"
                      className="underline hover:opacity-80"
                      style={{ color: '#1F8282' }}
                    >
                      Terms of Service
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
            {isLoading ? 'Processing…' : 'Proceed to Checkout'}
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
              Your payment is handled by Stripe. We never see or store your card details.
            </p>
            <p
              className="text-[11.5px] font-medium leading-snug"
              style={{ color: '#6B7F8B' }}
            >
              Your assessment data stays yours. We don't sell it, we don't share it, and you can permanently delete everything from your account at any time.
            </p>
          </div>
        </form>
      </Form>
    </div>
  );
}