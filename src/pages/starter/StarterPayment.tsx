import { useTranslation } from 'react-i18next';
import { CheckoutForm } from '../../components/CheckoutForm';
import AuthShell from '@/components/auth/AuthShell';
import AuthNavigation from '@/components/auth/AuthNavigation';

/**
 * Checkout for the Starter flavor (cairnly.io/starter). Same machinery as the
 * professional /payment route; the flavor prop makes payment-success mint an
 * access code that loads the starter survey.
 */
export default function StarterPayment() {
  const { t } = useTranslation('starter');

  return (
    <AuthShell
      eyebrow={t('shell.eyebrow')}
      title={t('shell.title')}
      subtitle={t('shell.subtitle')}
      width="xwide"
      footer={<AuthNavigation />}
    >
      <CheckoutForm flavor="starter" />
    </AuthShell>
  );
}
