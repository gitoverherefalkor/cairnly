import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ExternalLink } from 'lucide-react';
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
export type DemoTool = 'share' | 'invite' | 'jobs' | 'jobsSearch' | 'resume' | 'coverLetter' | 'generic' | 'apply';

interface DemoToolDialogProps {
  tool: DemoTool | null;
  onClose: () => void;
  audience: 'customer' | 'partner';
  // The persona's first name, for the invite note (the toolkit state shown
  // is the demo's: one referral counted for the job search).
  firstName?: string;
  // For the 'apply' tool: the listing the visitor pressed, and when the
  // search that found it ran. The dialog explains the listing is frozen and
  // may have closed, then still offers the door to the job board.
  applyHref?: string;
  searchDate?: string;
}

/**
 * What a visitor gets when they press a switched-off control on the demo
 * dashboard: an honest one-liner about what the button does for a real user,
 * and the way to become one. Every gated control (job search, résumé tailor,
 * cover letters, share card, invite flow) lands here instead of doing nothing.
 */
export const DemoToolDialog: React.FC<DemoToolDialogProps> = ({
  tool,
  onClose,
  audience,
  firstName,
  applyHref,
  searchDate,
}) => {
  const { t } = useTranslation('demo');
  const partner = audience === 'partner';
  const apply = tool === 'apply';
  const toolName = t(`dashboardDemo.tools.${tool ?? 'generic'}`);
  return (
    <Dialog open={tool !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" style={{ background: '#FDFBF2' }}>
        <DialogHeader>
          <DialogTitle className="font-heading text-[22px]" style={{ color: '#122E3B', fontWeight: 700 }}>
            {apply ? t('jobsDemo.apply.title') : t('dashboardDemo.tools.title')}
          </DialogTitle>
          <DialogDescription className="text-[15px] text-[#4B6373] font-medium leading-relaxed pt-1">
            {apply
              ? t('jobsDemo.apply.body', { date: searchDate ?? '' })
              : t(partner ? 'dashboardDemo.tools.bodyPartner' : 'dashboardDemo.tools.body', { tool: toolName })}
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
            {apply ? t('jobsDemo.apply.close') : t('dashboardDemo.tools.close')}
          </button>
          {apply ? (
            <a
              href={applyHref}
              target="_blank"
              rel="nofollow noopener noreferrer"
              onClick={() => {
                trackCtaClick('demo_job_apply_open');
                onClose();
              }}
              className="lp-btn-primary !text-[14px] !py-2.5 !px-5"
            >
              {t('jobsDemo.apply.open')}
              <ExternalLink size={15} strokeWidth={2.4} />
            </a>
          ) : partner ? (
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
