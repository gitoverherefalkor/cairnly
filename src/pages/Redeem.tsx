import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AuthShell from '@/components/auth/AuthShell';
import AuthNavigation from '@/components/auth/AuthNavigation';
import RedeemCodeForm from '@/components/redeem/RedeemCodeForm';

/**
 * cairnly.io/redeem: a short address partners and employers can mention
 * ("go to cairnly.io/redeem and enter your code"). ?code= prefills the field.
 */
export default function Redeem() {
  const { t } = useTranslation('auth');
  const [searchParams] = useSearchParams();

  return (
    <AuthShell
      eyebrow={t('redeem.pageEyebrow')}
      title={t('redeem.pageTitle')}
      subtitle={t('redeem.pageSubtitle')}
      width="narrow"
      footer={<AuthNavigation />}
    >
      <RedeemCodeForm variant="open" initialCode={searchParams.get('code') ?? ''} />
    </AuthShell>
  );
}
