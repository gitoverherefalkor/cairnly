
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const AuthNavigation = () => {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();

  return (
    <Button
      variant="ghost"
      onClick={() => navigate('/')}
      className="text-sm text-white/70 hover:text-white hover:bg-white/5 font-semibold"
    >
      <ArrowLeft className="h-4 w-4 mr-2" />
      {t('page.backToHomepage')}
    </Button>
  );
};

export default AuthNavigation;
