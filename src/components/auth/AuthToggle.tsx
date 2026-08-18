
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface AuthToggleProps {
  isLogin: boolean;
  onToggle: () => void;
}

const AuthToggle = ({ isLogin, onToggle }: AuthToggleProps) => {
  const { t } = useTranslation('auth');
  if (isLogin) {
    // On login page, link to payment flow instead of signup
    return (
      <div className="mt-6 text-center">
        <p className="text-sm" style={{ color: '#4B6373' }}>
          {t('page.noAccountYet')}
        </p>
        <Link to="/payment">
          <Button
            variant="link"
            className="p-0 h-auto font-semibold"
            style={{ color: '#1F8282' }}
          >
            {t('page.getAccessCodeFirst')}
          </Button>
        </Link>
      </div>
    );
  }

  // On signup page, allow toggle back to login
  return (
    <div className="mt-6 text-center">
      <p className="text-sm" style={{ color: '#4B6373' }}>
        {t('page.alreadyHaveAccount')}
      </p>
      <Button
        variant="link"
        onClick={onToggle}
        className="p-0 h-auto font-semibold"
        style={{ color: '#1F8282' }}
      >
        {t('page.signInHere')}
      </Button>
    </div>
  );
};

export default AuthToggle;
