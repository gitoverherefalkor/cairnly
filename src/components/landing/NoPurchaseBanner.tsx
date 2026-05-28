import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';

/**
 * Shown above the landing hero when a user was just bounced from sign-in
 * because their account has no purchase or product activity. Reads
 * ?signed_out=no_purchase&email=... from the URL.
 *
 * Renders nothing if the param is absent.
 */
const NoPurchaseBanner: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('landing');
  const [email, setEmail] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('signed_out') === 'no_purchase') {
      setEmail(params.get('email'));
    }
  }, []);

  if (dismissed || email === null) return null;

  return (
    <div
      role="status"
      className="w-full px-4 py-3 text-sm"
      style={{ background: '#FFF6D6', borderBottom: '1px solid rgba(201,182,144,0.6)', color: '#122E3B' }}
    >
      <div className="max-w-5xl mx-auto flex items-start gap-3">
        <div className="flex-1">
          <p className="font-semibold mb-1">
            {email ? t('noPurchaseBanner.titleWithEmail', { email }) : `${t('noPurchaseBanner.title')}.`}
          </p>
          <p>
            {t('noPurchaseBanner.body')}{' '}
            <button
              type="button"
              onClick={() => navigate('/payment')}
              className="font-semibold underline hover:no-underline"
              style={{ color: '#1F8282' }}
            >
              {t('noPurchaseBanner.ctaBuy')}
            </button>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label={t('noPurchaseBanner.dismissLabel')}
          className="p-1 rounded hover:bg-black/5"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default NoPurchaseBanner;
