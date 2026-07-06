import { useTranslation } from 'react-i18next';
import { CheckoutForm } from '../../components/CheckoutForm';
import AuthShell from '@/components/auth/AuthShell';
import AuthNavigation from '@/components/auth/AuthNavigation';

/**
 * Checkout for the Encore flavor (cairnly.io/encore). Same machinery as the
 * professional /payment route; the flavor prop makes create-checkout charge
 * the encore price and payment-success mint an access code that loads the
 * encore survey.
 */
export default function EncorePayment() {
  const { t } = useTranslation('encore');

  return (
    <AuthShell
      eyebrow={t('shell.eyebrow')}
      title={t('shell.title')}
      subtitle={t('shell.subtitle')}
      width="xwide"
      footer={<AuthNavigation />}
    >
      <CheckoutForm flavor="encore" />
    </AuthShell>
  );
}
