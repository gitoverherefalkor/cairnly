
import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { captureReferralFromUrl } from "@/lib/referral";
import { Loader2 } from "lucide-react";

// Eagerly load the landing page, payment route, and global components.
// Payment is eagerly loaded because it's the primary conversion route — a
// slow lazy-chunk fetch on first click ("Get Beta Access") was causing
// blank-page reports for first-time visitors.
import Index from "./pages/Index";
import Payment from "./pages/Payment";
import NotFound from "./pages/NotFound";
import CookieConsentBanner from "./components/CookieConsentBanner";
import SupportButton from "./components/support/SupportButton";
import { ChunkLoadErrorBoundary } from "./components/ChunkLoadErrorBoundary";

// Lazy load all other routes — only downloaded when the user navigates to them
const PaymentSuccess = lazy(() => import("./components/PaymentSuccess"));
const Assessment = lazy(() => import("./pages/Assessment"));
const Auth = lazy(() => import("./pages/Auth"));
const AuthConfirm = lazy(() => import("./pages/AuthConfirm"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Profile = lazy(() => import("./pages/Profile"));
const Chat = lazy(() => import("./pages/Chat"));
const ReportProcessing = lazy(() => import("./pages/ReportProcessing"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const CookiePolicy = lazy(() => import("./pages/CookiePolicy"));
const Support = lazy(() => import("./pages/Support"));
const Security = lazy(() => import("./pages/Security"));
const ColorTest = lazy(() => import("./pages/ColorTest"));
const Jobs = lazy(() => import("./pages/Jobs"));
const Journal = lazy(() => import("./pages/Journal"));
const JournalArticle = lazy(() => import("./pages/JournalArticle"));
const NewsletterConfirm = lazy(() => import("./pages/NewsletterConfirm"));
const NewsletterUnsubscribe = lazy(() => import("./pages/NewsletterUnsubscribe"));
// Note: Payment is intentionally NOT lazy-loaded — see eager imports above.

// Loading fallback shown while lazy chunks are downloading
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <Loader2 className="h-8 w-8 animate-spin text-atlas-blue" />
  </div>
);

const queryClient = new QueryClient();

// Syncs i18next language with the user's Supabase profile preference
const LanguageSync = ({ children }: { children: React.ReactNode }) => {
  useLanguage();
  return <>{children}</>;
};

// Atlas runs on a single editorial palette (teal-navy canvas + warm-paper
// cream cards). The `.dark` class drives that palette via the CSS variables
// in index.css, so we lock it on permanently and never toggle it off.
const ThemeScopeGuard = () => {
  React.useEffect(() => {
    document.documentElement.classList.add('dark');
    // Capture a referral code if the visitor arrived via a ?ref= link.
    captureReferralFromUrl();
  }, []);
  return null;
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <LanguageSync>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ThemeScopeGuard />
          <ChunkLoadErrorBoundary>
            <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth/confirm" element={<AuthConfirm />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/payment-success" element={<PaymentSuccess />} />
              <Route path="/assessment" element={<Assessment />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/report-processing" element={<ReportProcessing />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms-conditions" element={<TermsOfService />} />
              <Route path="/cookie-policy" element={<CookiePolicy />} />
              <Route path="/support" element={<Support />} />
              <Route path="/security" element={<Security />} />
              <Route path="/payment" element={<Payment />} />
              <Route path="/color-test" element={<ColorTest />} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/journal" element={<Journal />} />
              <Route path="/journal/:slug" element={<JournalArticle />} />
              <Route path="/newsletter/confirm" element={<NewsletterConfirm />} />
              <Route path="/newsletter/unsubscribe" element={<NewsletterUnsubscribe />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </ChunkLoadErrorBoundary>
          <CookieConsentBanner />
          <SupportButton />
        </BrowserRouter>
      </TooltipProvider>
      </LanguageSync>
    </AuthProvider>
  </QueryClientProvider>
  );
};

export default App;
