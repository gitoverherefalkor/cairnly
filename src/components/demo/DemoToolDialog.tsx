import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CALENDLY_URL } from '@/components/partners/constants';
import { trackCtaClick } from '@/lib/analytics';

// The dashboard controls that would cost money or need a session in a real
// account. Each maps to a short description of what it opens.
export type DemoTool = 'share' | 'invite' | 'jobs' | 'jobsSearch' | 'resume' | 'coverLetter' | 'generic';

interface DemoToolDialogProps {
  tool: DemoTool | null;
  onClose: () => void;
  audience: 'customer' | 'partner';
  // The persona's first name, for the invite note (the toolkit state shown
  // is the demo's: one referral counted for the job search).
  firstName?: string;
}

/**
 * What a visitor gets when they press a switched-off control on the demo
 * dashboard: an honest one-liner about what the button does for a real user,
 * and the way to become one. Every gated control (job search, résumé tailor,
 * cover letters, share card, invite flow) lands here instead of doing nothing.
 */
export const DemoToolDialog: React.FC<DemoToolDialogProps> = ({ tool, onClose, audience, firstName }) => {
  const { t } = useTranslation('demo');
  const partner = audience === 'partner';
  const toolName = t(`dashboardDemo.tools.${tool ?? 'generic'}`);
  return (
    <Dialog open={tool !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" style={{ background: '#FDFBF2' }}>
        <DialogHeader>
          <DialogTitle className="font-heading text-[22px]" style={{ color: '#122E3B', fontWeight: 700 }}>
            {t('dashboardDemo.tools.title')}
          </DialogTitle>
          <DialogDescription className="text-[15px] text-[#4B6373] font-medium leading-relaxed pt-1">
            {t(partner ? 'dashboardDemo.tools.bodyPartner' : 'dashboardDemo.tools.body', { tool: toolName })}
            {tool === 'invite' && (
              <span className="block mt-3">{t('dashboardDemo.tools.inviteNote', { name: firstName ?? '' })}</span>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="text-[14px] font-semibold text-[#4B6373] hover:text-[#122E3B] underline underline-offset-4"
          >
            {t('dashboardDemo.tools.close')}
          </button>
          {partner ? (
            <a
              href={CALENDLY_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackCtaClick('demo_dashboard_partner_call')}
              className="lp-btn-primary lp-btn-gold !text-[14px] !py-2.5 !px-5"
            >
              {t('footer.ctaPartner')}
              <ArrowRight size={16} strokeWidth={2.4} />
            </a>
          ) : (
            <Link
              to="/payment"
              onClick={() => trackCtaClick('demo_dashboard_start')}
              className="lp-btn-primary lp-btn-gold !text-[14px] !py-2.5 !px-5"
            >
              {t('footer.ctaCustomer')}
              <ArrowRight size={16} strokeWidth={2.4} />
            </Link>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
