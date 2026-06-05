import React, { useState } from 'react';
import { LifeBuoy } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import SupportDialog from './SupportDialog';

// Floating Support & Feedback button. Renders only when a user is logged in.
const SupportButton = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Feedback and support"
        title="Feedback &amp; Support"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-atlas-teal p-3 sm:px-4 sm:py-3 text-sm font-medium text-white shadow-lg hover:bg-atlas-teal/90 transition-colors"
      >
        <LifeBuoy className="h-4 w-4 flex-shrink-0" />
        {/* Label hidden on mobile so the floating button collapses to a compact
            icon and no longer covers primary actions (e.g. the survey's
            Continue button). Full pill returns at the sm breakpoint. */}
        <span className="hidden sm:inline">Feedback &amp; Support</span>
      </button>
      <SupportDialog open={open} onOpenChange={setOpen} />
    </>
  );
};

export default SupportButton;
