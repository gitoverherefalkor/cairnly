import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SupportForm from '@/components/support/SupportForm';

const Support = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('support');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Button variant="ghost" onClick={() => navigate('/')} className="mr-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('page.back')}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold text-white mb-6">{t('page.title')}</h1>

        <div className="bg-white rounded-lg shadow-sm p-8">
          <p className="text-gray-600 leading-relaxed mb-6">
            {t('page.intro')}
          </p>
          <SupportForm />
        </div>
      </div>
    </div>
  );
};

export default Support;
